import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import type { Href } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { forgetDeviceVault, hasDeviceVault } from "@/crypto/device-vault";
import { deviceDraftFiles, sqliteDraftDb } from "@/features/capture/draft-db";
import { draftStore } from "@/features/capture/draft-store";
import { discardExport } from "@/features/export/export-job";
import { clearItemSummaries } from "@/features/vault/summary-cache";
import { clearFormDrafts } from "@/lib/form-drafts";
import { isNewNumberPending, setNewNumberPending } from "@/lib/lost-number";
import { auditContext } from "@/lib/use-audited-mutation";
import {
  readResumePoint,
  readSetupPending,
  resumeTarget,
  writeResumePoint,
  writeSetupPending,
  type ResumePoint,
} from "@/lib/resume-point";
import { resolveStage, type Stage } from "@/lib/session-stage";
import { useVault } from "./vault-provider";

/** The signed-in user as `users.viewer` projects it (no analytics fields). */
export type Viewer = NonNullable<FunctionReturnType<typeof api.users.viewer>>;

interface SessionValue {
  stage: Stage;
  /** Onboarding, or showing a renewed recovery kit: (setup) must finish. */
  settingUp: boolean;
  viewer: Viewer | null | undefined;
  /** Re-read whether this phone holds a wrapped vault key. */
  refreshDeviceVault: () => void;
  deferMigration: () => void;
  /** Lost number, 24-word sign-in coming: ask for the new number first. */
  expectNewNumber: (expected: boolean) => void;
  signOut: () => Promise<void>;
  resumeReady: boolean;
  rememberRoute: (pathname: string, params: Record<string, string>) => void;
  takeResume: () => Href | null;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut: convexSignOut } = useAuthActions();
  const { masterKey, lock, finishingSetup, setFinishingSetup } = useVault();
  const skip = isAuthenticated ? {} : "skip";
  const viewer = useQuery(api.users.viewer, skip);
  const loginGate = useQuery(api.login_otp.getMyLoginOtpGate, skip);
  const totpGate = useQuery(api.totp.getMyTotpGate, skip);
  const migration = useQuery(api.account_migration.getStatus, skip);
  const proofs = useQuery(api.session_proofs.getMine, skip);
  const [numberLost, setNumberLost] = useState(isNewNumberPending);
  const [vaultState, setVaultState] = useState<{
    userId: string;
    has: boolean;
  } | null>(null);
  const [migrationDeferred, setMigrationDeferred] = useState(false);
  const [vaultCheck, setVaultCheck] = useState(0);
  const userId = viewer?._id;

  useEffect(() => {
    if (userId) void draftStore.attach(userId, sqliteDraftDb, deviceDraftFiles);
  }, [userId]);
  // Only trust a result read for the current user.
  const deviceVault =
    vaultState && vaultState.userId === userId ? vaultState.has : undefined;
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const lastRoute = useRef<ResumePoint | null>(null);
  const resumed = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    Promise.all([readResumePoint(userId), readSetupPending(userId)])
      .catch(() => [null, false] as const)
      .then(([point, pending]) => {
        if (!alive) return;
        lastRoute.current = point;
        setFinishingSetup(pending);
        setSavedFor(userId);
      });
    return () => {
      alive = false;
    };
  }, [userId, setFinishingSetup]);

  useEffect(() => {
    if (!userId || savedFor !== userId) return;
    void writeSetupPending(userId, finishingSetup).catch(() => undefined);
  }, [userId, savedFor, finishingSetup]);

  useEffect(() => {
    if (!masterKey) resumed.current = false;
  }, [masterKey]);

  const rememberRoute = useCallback(
    (pathname: string, params: Record<string, string>) => {
      if (!userId) return;
      const point = { pathname, params, at: Date.now() };
      lastRoute.current = point;
      void writeResumePoint(userId, point).catch(() => undefined);
    },
    [userId],
  );

  const takeResume = useCallback(() => {
    if (resumed.current) return null;
    resumed.current = true;
    return resumeTarget(lastRoute.current, finishingSetup, Date.now());
  }, [finishingSetup]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    hasDeviceVault(userId).then(
      (has) => alive && setVaultState({ userId, has }),
    );
    return () => {
      alive = false;
    };
  }, [userId, vaultCheck]);

  // The new number is set once this session proved one (verifyCode): the
  // stage no longer waits for it, and a restart must not ask again.
  useEffect(() => {
    if (numberLost && proofs?.phone) setNewNumberPending(false);
  }, [numberLost, proofs?.phone]);

  const expectNewNumber = useCallback((expected: boolean) => {
    setNewNumberPending(expected);
    setNumberLost(expected);
  }, []);

  const signOut = useCallback(async () => {
    if (userId) await draftStore.detach(userId);
    clearFormDrafts();
    if (userId) {
      await forgetDeviceVault(userId);
      await clearItemSummaries(userId).catch(() => undefined);
    }
    lock();
    setFinishingSetup(false);
    discardExport();
    auditContext.clear();
    setMigrationDeferred(false);
    setNewNumberPending(false);
    setNumberLost(false);
    await convexSignOut();
  }, [userId, lock, setFinishingSetup, convexSignOut]);

  const stage = resolveStage({
    authLoading: isLoading,
    authenticated: isAuthenticated,
    viewer:
      viewer === undefined
        ? undefined
        : viewer && { hasKeyBundle: !!viewer.encryptedKeyBundle },
    loginOtpRequired: loginGate?.required,
    totpRequired: totpGate?.required,
    newNumberPending: numberLost
      ? proofs === undefined
        ? undefined
        : !proofs?.phone
      : false,
    needsMigration:
      migration === undefined ? undefined : !!migration?.needsMigration,
    migrationDeferred,
    hasDeviceVault: deviceVault,
    unlocked: masterKey !== null,
  });

  const value = useMemo<SessionValue>(
    () => ({
      stage,
      settingUp: stage === "setup" || finishingSetup,
      viewer,
      refreshDeviceVault: () => setVaultCheck((n) => n + 1),
      deferMigration: () => setMigrationDeferred(true),
      expectNewNumber,
      signOut,
      resumeReady: !userId || savedFor === userId,
      rememberRoute,
      takeResume,
    }),
    [
      stage,
      finishingSetup,
      viewer,
      expectNewNumber,
      signOut,
      userId,
      savedFor,
      rememberRoute,
      takeResume,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** The signed-in user; only for screens behind an authenticated stage. */
export function useViewer(): Viewer {
  const { viewer } = useSession();
  if (!viewer) throw new Error("No signed-in user");
  return viewer;
}
