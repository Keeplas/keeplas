"use client";

import { useEffect, useRef } from "react";
import { unwrapBytes } from "@keeplas/crypto/kem";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import {
  envelopeFingerprint,
  getStoredShard,
  putStoredShard,
} from "@/lib/recovery-shard-store";

interface IncomingVault {
  userId: string;
  encryptedShard?: string;
  contactType?: "trust" | "recipient_only";
  invitationStatus: string;
}

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
) {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const inFlightRef = useRef(false);

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
    if (candidates.length === 0) return;

    inFlightRef.current = true;

    void (async () => {
      try {
        const { secretKey } = await ensureOwnerKeypair();

        for (const vault of candidates) {
          const envelope = vault.encryptedShard as string;
          const fp = await envelopeFingerprint(envelope);

          const existing = await getStoredShard(vault.userId);
          if (existing && existing.envelopeHash === fp) continue;

          try {
            const raw = await unwrapBytes(envelope, secretKey);
            await putStoredShard({
              ownerUserId: vault.userId,
              rawShard: raw,
              envelopeHash: fp,
              storedAt: Date.now(),
            });
          } catch {
            // Single envelope failure shouldn't block the others — likely
            // means the owner re-distributed with a different key while the
            // contact was offline. They'll see "Shard verification not
            // ready" until the owner re-runs distribution.
          }
        }
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [vaults, isReady, ensureOwnerKeypair]);
}
