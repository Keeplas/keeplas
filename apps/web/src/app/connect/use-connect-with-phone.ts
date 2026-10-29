import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  buildPairingQr,
  generateBrowserPairingKeys,
  openPairingEnvelope,
  pairingCode,
  pairingKeyHash,
} from "@keeplas/crypto/pairing";
import { importMasterKey } from "@/lib/device-unlock/key-import";
import { useMasterKey } from "@/lib/master-key-context";
import { initialPairingState, pairingReducer } from "@/lib/pairing-flow";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRequestContext } from "@/lib/use-request-context";
import { deviceLabelFromUserAgent } from "@/lib/user-agent";

/**
 * How long a browser linked without "Keep me logged in" stays unlocked, across
 * refreshes, before it must be linked again.
 */
const UNTRUSTED_LINK_TTL_MS = 60 * 60 * 1000;

/** Ephemeral pairing secrets: memory only, erased as soon as they are spent. */
interface PairingSecrets {
  secretKey: Uint8Array;
  loginSecret: string;
  qrSecret: string;
}

/**
 * W04-2 side effects around `pairingReducer` (ARCHITECTURE.md § 8): open a
 * pairing session, follow its status, then sign in, open the MasterKey
 * envelope and register this browser.
 */
export function useConnectWithPhone() {
  const [state, dispatch] = useReducer(pairingReducer, initialPairingState);
  const [trusted, setTrusted] = useState(false);
  const secrets = useRef<PairingSecrets | null>(null);
  const startedPhase = useRef<string | null>(null);
  const attempt = useRef(0);

  const audit = useRequestContext();
  const viewer = useQuery(api.users.viewer);
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const { setMasterKey } = useMasterKey();
  const createSession = useMutation(api.pairing.create);
  const readEnvelope = useAuditedMutation(api.pairing.readEnvelope);
  const registerDevice = useAuditedMutation(api.devices.register);
  const status = useQuery(
    api.pairing.status,
    state.phase === "waiting" ? { sessionId: state.sessionId } : "skip",
  );

  const wipeSecrets = useCallback(() => {
    secrets.current?.secretKey.fill(0);
    secrets.current = null;
  }, []);

  // Runs `effect` once per phase entry (React may re-run effects at will).
  const runOnce = useCallback((key: string, effect: () => Promise<void>) => {
    if (startedPhase.current === key) return;
    startedPhase.current = key;
    void effect();
  }, []);

  // 1. New keys + pairing session (initial load and "Generate a new code").
  useEffect(() => {
    if (state.phase !== "creating" || !audit || authLoading) return;
    runOnce(`creating:${attempt.current}`, async () => {
      try {
        if (isAuthenticated) await signOut();
        wipeSecrets();
        const keys = await generateBrowserPairingKeys();
        secrets.current = {
          secretKey: keys.secretKey,
          loginSecret: keys.loginSecret,
          qrSecret: keys.qrSecret,
        };
        const { sessionId, expiresAt } = await createSession({
          browserPublicKey: keys.publicKey,
          secretHash: keys.loginSecretHash,
          userAgent: navigator.userAgent,
          _audit: audit,
        });
        const qr = {
          sessionId,
          keyHash: await pairingKeyHash(keys.publicKey),
          origin: window.location.origin,
          qrSecret: keys.qrSecret,
        };
        dispatch({
          type: "created",
          sessionId,
          expiresAt,
          qrUrl: buildPairingQr(qr),
          code: await pairingCode(qr),
        });
      } catch {
        dispatch({ type: "failed" });
      }
    });
  }, [
    state.phase,
    audit,
    authLoading,
    isAuthenticated,
    runOnce,
    signOut,
    wipeSecrets,
    createSession,
  ]);

  // 2. Follow the phone (reactive query, no polling).
  useEffect(() => {
    if (status) dispatch({ type: "status", status });
  }, [status]);

  // 3. Approved: redeem the login secret (single use, 60 s).
  useEffect(() => {
    if (state.phase !== "signingIn") return;
    runOnce(`signingIn:${state.sessionId}`, async () => {
      try {
        await signIn("pairing", {
          sessionId: state.sessionId,
          secret: secrets.current!.loginSecret,
        });
        dispatch({ type: "signedIn" });
      } catch {
        dispatch({ type: "failed" });
      }
    });
  }, [state, runOnce, signIn]);

  // 4. Signed in (viewer loaded): open the envelope, unlock, register.
  useEffect(() => {
    if (state.phase !== "unlocking" || !viewer) return;
    runOnce(`unlocking:${state.sessionId}`, async () => {
      try {
        const sealed = await readEnvelope({
          sessionId: state.sessionId,
          secret: secrets.current!.loginSecret,
        });
        if (!viewer.identityPublicKey) {
          throw new Error("Account has no identity key");
        }
        const raw = await openPairingEnvelope({
          ...sealed,
          secretKey: secrets.current!.secretKey,
          sessionId: state.sessionId,
          origin: window.location.origin,
          qrSecret: secrets.current!.qrSecret,
          identityPublicKey: viewer.identityPublicKey,
          userId: viewer._id,
        });
        try {
          setMasterKey(await importMasterKey(raw), {
            expiresAt: trusted ? undefined : Date.now() + UNTRUSTED_LINK_TTL_MS,
          });
        } finally {
          raw.fill(0);
        }
        wipeSecrets();
        await registerDevice({
          kind: "web",
          label: deviceLabelFromUserAgent(navigator.userAgent),
          trusted,
        });
        dispatch({ type: "linked" });
      } catch {
        dispatch({ type: "failed" });
      }
    });
  }, [
    state,
    viewer,
    trusted,
    runOnce,
    wipeSecrets,
    readEnvelope,
    setMasterKey,
    registerDevice,
  ]);

  // The secret key must not outlive the attempt, whatever its outcome.
  useEffect(() => {
    if (
      state.phase === "expired" ||
      state.phase === "rejected" ||
      state.phase === "error"
    ) {
      wipeSecrets();
    }
  }, [state.phase, wipeSecrets]);
  useEffect(() => wipeSecrets, [wipeSecrets]);

  return {
    state,
    trusted,
    setTrusted,
    restart: () => {
      attempt.current += 1;
      dispatch({ type: "restart" });
    },
    expire: () => dispatch({ type: "status", status: "expired" }),
  };
}
