import { useCallback } from "react";
import { ConvexError } from "convex/values";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  pairingKeyHash,
  sealPairingEnvelope,
  type PairingQr,
} from "@keeplas/crypto/pairing";

import { unwrapSecretUnderMasterKey } from "@/crypto/vault-keys";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

export class PresenceDeclined extends Error {
  constructor() {
    super("PRESENCE_DECLINED");
  }
}

export class PairingKeyMismatch extends Error {
  constructor(readonly receivedHash: string) {
    super("PAIRING_KEY_MISMATCH");
  }
}

/**
 * M03-4 scan → M03-6: biometric step-up, re-check the browser key against the
 * QR, seal the MasterKey to it, sign with the identity key, then
 * `pairing.approve`. The raw MasterKey is wiped right after sealing.
 */
export function useApprovePairing() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { confirmPresence, masterKey, exportRawMasterKey } = useVault();
  const approve = useAuditedMutation(api.pairing.approve);

  return useCallback(
    async (qr: PairingQr, browserPublicKey: string) => {
      if (!masterKey || !viewer.encryptedIdentitySecretKey) {
        throw new Error("Identity key unavailable");
      }
      await confirmPresence(viewer._id, t("linkBrowser.confirmTitle")).catch(
        () => {
          throw new PresenceDeclined();
        },
      );
      const receivedHash = await pairingKeyHash(browserPublicKey);
      if (receivedHash !== qr.keyHash)
        throw new PairingKeyMismatch(receivedHash);

      const identitySecretKey = await unwrapSecretUnderMasterKey(
        viewer.encryptedIdentitySecretKey,
        masterKey,
      );
      const raw = await exportRawMasterKey();
      let sealed: { envelope: string; approvalSignature: string };
      try {
        sealed = await sealPairingEnvelope({
          masterKey: raw,
          userId: viewer._id,
          browserPublicKey,
          sessionId: qr.sessionId,
          origin: qr.origin,
          identitySecretKey,
        });
      } finally {
        raw.fill(0);
      }
      try {
        await approve({
          sessionId: qr.sessionId as Id<"pairing_sessions">,
          keyHash: qr.keyHash,
          ...sealed,
        });
      } catch (error) {
        if (
          error instanceof ConvexError &&
          error.data === "PAIRING_KEY_MISMATCH"
        ) {
          throw new PairingKeyMismatch(receivedHash);
        }
        throw error;
      }
    },
    [t, viewer, masterKey, confirmPresence, exportRawMasterKey, approve],
  );
}
