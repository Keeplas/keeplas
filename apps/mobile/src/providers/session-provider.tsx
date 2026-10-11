import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

import { forgetDeviceVault, hasDeviceVault } from "@/crypto/device-vault";
import { auditContext } from "@/lib/use-audited-mutation";
import { resolveStage, type Stage } from "@/lib/session-stage";
import { useVault } from "./vault-provider";

interface SessionValue {
  stage: Stage;
  viewer: Doc<"users"> | null | undefined;
  /** Re-read whether this phone holds a wrapped vault key. */
  refreshDeviceVault: () => void;
  deferMigration: () => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut: convexSignOut } = useAuthActions();
  const { masterKey, lock } = useVault();
  const skip = isAuthenticated ? {} : "skip";
  const viewer = useQuery(api.users.viewer, skip);
  const loginGate = useQuery(api.login_otp.getMyLoginOtpGate, skip);
  const migration = useQuery(api.account_migration.getStatus, skip);
  const [vaultState, setVaultState] = useState<{
    userId: string;
    has: boolean;
  } | null>(null);
  const [migrationDeferred, setMigrationDeferred] = useState(false);
  const [vaultCheck, setVaultCheck] = useState(0);
  const userId = viewer?._id;
  // Only trust a result read for the current user.
  const deviceVault =
    vaultState && vaultState.userId === userId ? vaultState.has : undefined;

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

  const signOut = useCallback(async () => {
    if (userId) await forgetDeviceVault(userId);
    lock();
    auditContext.clear();
    setMigrationDeferred(false);
    await convexSignOut();
  }, [userId, lock, convexSignOut]);

  const stage = resolveStage({
    authLoading: isLoading,
    authenticated: isAuthenticated,
    viewer:
      viewer === undefined
        ? undefined
        : viewer && { hasKeyBundle: !!viewer.encryptedKeyBundle },
    loginOtpRequired: loginGate?.required,
    needsMigration:
      migration === undefined ? undefined : !!migration?.needsMigration,
    migrationDeferred,
    hasDeviceVault: deviceVault,
    unlocked: masterKey !== null,
  });

  const value = useMemo<SessionValue>(
    () => ({
      stage,
      viewer,
      refreshDeviceVault: () => setVaultCheck((n) => n + 1),
      deferMigration: () => setMigrationDeferred(true),
      signOut,
    }),
    [stage, viewer, signOut],
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
export function useViewer(): Doc<"users"> {
  const { viewer } = useSession();
  if (!viewer) throw new Error("No signed-in user");
  return viewer;
}
