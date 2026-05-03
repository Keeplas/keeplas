"use client";

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
  vaults: ReadonlyArray<IncomingVault> | undefined
): { status: ReceiveShardStatus } {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const confirmShardVerified = useAuditedMutation(
    api.trusted_contacts.confirmShardVerified
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
        v.encryptedShard.length > 0
    );
    if (candidates.length === 0) {
      setStatus("ready");
      return;
    }

    inFlightRef.current = true;

    void (async () => {
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
          const alreadyHaveCurrent =
            existing && existing.envelopeHash === fp;

          let didUnwrap = alreadyHaveCurrent;
          if (!alreadyHaveCurrent) {
            try {
              const raw = await unwrapBytes(envelope, secretKey);
              await putStoredShard({
                ownerUserId: vault.userId,
                rawShard: raw,
                envelopeHash: fp,
                storedAt: Date.now(),
              });
              didUnwrap = true;
            } catch {
              // Single envelope failure shouldn't block the others — likely
              // means the owner re-distributed with a different key while
              // the contact was offline. They'll see "Hash not yet verified"
              // until the owner re-runs distribution.
              didUnwrap = false;
            }
          }

          // Successfully unwrapping the shard is a stronger proof than the
          // round-trip envelope check — stamp `lastVerifiedAt` so the owner
          // sees "Hash verified Xd ago" without requiring a manual click.
          // Only re-stamp once per session per envelope to avoid mutation
          // spam on every page load.
          if (didUnwrap && !vault.lastVerifiedAt) {
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
