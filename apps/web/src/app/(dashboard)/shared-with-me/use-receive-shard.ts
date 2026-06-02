import { useEffect, useRef, useState } from "react";
import { unwrapBytes } from "@keeplas/crypto/kem";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  envelopeFingerprint,
  getStoredShard,
  putStoredShard,
} from "@/lib/recovery-shard-store";
import { STALE_VERIFICATION_THRESHOLD_MS } from "../trusted-contacts/contact-display";

interface IncomingVault {
  _id: Id<"trusted_contacts">;
  userId: string;
  encryptedShard?: string;
  contactType?: "trust" | "recipient_only";
  invitationStatus: string;
  lastVerifiedAt?: number;
}

export type ReceiveShardStatus = "idle" | "restoring" | "ready";

/**
 * For each vault that names the current user as a trust contact, unwrap
 * the server-stored encryptedShard exactly once per envelope fingerprint
 * and persist the raw bytes in IndexedDB. Subsequent reads (recovery
 * submission) hit the local store, never the server.
 *
 * Idempotent and safe to re-run on every render: rows whose fingerprint
 * matches the local copy are skipped.
 */
export function useReceiveShard(
  vaults: ReadonlyArray<IncomingVault> | undefined,
): { status: ReceiveShardStatus } {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const confirmShardVerified = useAuditedMutation(
    api.trusted_contacts.confirmShardVerified,
  );
  const inFlightRef = useRef(false);
  const [status, setStatus] = useState<ReceiveShardStatus>("idle");

  useEffect(() => {
    if (!isReady || !vaults) return;
    if (inFlightRef.current) return;

    const candidates = vaults.filter(
      (v) =>
        v.invitationStatus === "accepted" &&
        (v.contactType ?? "trust") === "trust" &&
        typeof v.encryptedShard === "string" &&
        v.encryptedShard.length > 0,
    );
    inFlightRef.current = true;

    void (async () => {
      // No shards to receive — settle immediately. Resetting the in-flight
      // guard keeps the effect re-runnable when `vaults` later changes.
      if (candidates.length === 0) {
        inFlightRef.current = false;
        setStatus("ready");
        return;
      }

      // Pre-scan: if at least one candidate has no local shard with the
      // current envelope fingerprint, we're restoring (likely fresh device,
      // or owner re-distributed). Surface a brief loader to the contact so
      // they see why the page momentarily looks "empty".
      let anyNeedsUnwrap = false;
      for (const vault of candidates) {
        const envelope = vault.encryptedShard as string;
        const fp = await envelopeFingerprint(envelope);
        const existing = await getStoredShard(vault.userId);
        if (!existing || existing.envelopeHash !== fp) {
          anyNeedsUnwrap = true;
          break;
        }
      }
      if (anyNeedsUnwrap) setStatus("restoring");

      try {
        const { secretKey } = await ensureOwnerKeypair();

        for (const vault of candidates) {
          const envelope = vault.encryptedShard as string;
          const fp = await envelopeFingerprint(envelope);

          const existing = await getStoredShard(vault.userId);
          const alreadyHaveCurrent = existing && existing.envelopeHash === fp;

          // Re-verify when the owner has never seen a stamp or it has gone
          // stale (periodic liveness). A *fresh* unwrap is the proof, so we
          // also unwrap when stale even if the local copy is already current.
          const needsVerification =
            !vault.lastVerifiedAt ||
            Date.now() - vault.lastVerifiedAt > STALE_VERIFICATION_THRESHOLD_MS;

          // Nothing to do: local shard is current and verification is fresh.
          if (alreadyHaveCurrent && !needsVerification) continue;

          let unwrapped = false;
          try {
            const raw = await unwrapBytes(envelope, secretKey);
            if (!alreadyHaveCurrent) {
              await putStoredShard({
                ownerUserId: vault.userId,
                rawShard: raw,
                envelopeHash: fp,
                storedAt: Date.now(),
              });
            }
            unwrapped = true;
          } catch {
            // Single envelope failure shouldn't block the others — likely
            // means the owner re-distributed with a different key while
            // the contact was offline. They'll see "Hash not yet verified"
            // until the owner re-runs distribution.
            unwrapped = false;
          }

          // Successfully unwrapping the real shard is the verification — a
          // stronger proof than any round-trip sentinel — so stamp
          // `lastVerifiedAt` automatically. Bounded by `needsVerification`
          // to avoid mutation spam on every page load.
          if (unwrapped && needsVerification) {
            try {
              await confirmShardVerified({ contactId: vault._id });
            } catch {
              // Mutation failure is non-fatal — UI will still reflect the
              // local IndexedDB state on next load.
            }
          }
        }
      } finally {
        inFlightRef.current = false;
        setStatus("ready");
      }
    })();
  }, [vaults, isReady, ensureOwnerKeypair, confirmShardVerified]);

  return { status };
}
