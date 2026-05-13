"use client";

import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useMasterKey } from "@/lib/master-key-context";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { api } from "@keeplas/backend/_generated/api";
import { split } from "@keeplas/crypto/shamir";
import { wrapBytes } from "@keeplas/crypto/kem";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";

export type DistributeStatus =
  | "idle"
  | "running"
  | "ok"
  | "error"
  | "missing_master_key"
  | "no_targets";

interface DistributeResult {
  contactsDistributed: number;
  threshold: number;
}

/**
 * Distribute Shamir shards of the master key to every accepted trust
 * contact that has uploaded a public key. Each call re-splits the master
 * key with the user's chosen threshold (or 2 by default), so any previously
 * distributed shard is invalidated — that's by design: the threshold is the
 * crypto contract, not a per-contact setting.
 *
 * Flow: split → device shard to localStorage → keeplas shard to server →
 * for each contact, wrap their slot's share to their public key and store
 * via storeEncryptedShard.
 */
export function useDistributeShards(): {
  distribute: () => Promise<DistributeResult | null>;
  status: DistributeStatus;
  error: string | null;
} {
  const { masterKey } = useMasterKey();
  const me = useQuery(api.onboarding.getOnboardingState);
  const targets = useQuery(api.trusted_contacts.getDistributionTargets);
  const updateKeeplasShard = useAuditedMutation(
    api.trusted_contacts.updateKeeplasShard,
  );
  const storeEncryptedShard = useAuditedMutation(
    api.trusted_contacts.storeEncryptedShard,
  );

  const [status, setStatus] = useState<DistributeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const distribute = useCallback(async () => {
    setError(null);

    if (!masterKey) {
      setStatus("missing_master_key");
      setError("Unlock your vault before distributing shards.");
      return null;
    }
    if (!targets || targets.length === 0) {
      setStatus("no_targets");
      setError(
        "No trust contact is ready yet. Each contact must accept the invitation and publish their key first.",
      );
      return null;
    }

    setStatus("running");
    let rawMasterKey: Uint8Array | null = null;

    try {
      const threshold = me?.vaultThreshold ?? 2;
      rawMasterKey = new Uint8Array(
        await crypto.subtle.exportKey("raw", masterKey),
      );

      // Re-split: 5 total shares, current threshold. Slots:
      //   shards[0] → device (localStorage)
      //   shards[1..3] → trust contacts at shardIndex 2..4
      //   shards[4] → Keeplas custodian (server)
      const shards = await split(rawMasterKey, 5, threshold);

      try {
        localStorage.setItem(
          STORAGE_KEYS.deviceShard,
          uint8ToBase64(shards[0]),
        );
      } catch {
        // Private mode etc — non-fatal; the contact + keeplas shards still
        // satisfy the threshold without the device shard.
      }

      const keeplasShardB64 = uint8ToBase64(shards[4]);
      await updateKeeplasShard({ keeplasShard: keeplasShardB64 });

      let distributed = 0;
      for (const target of targets) {
        const slotIdx = target.shardIndex - 1; // shardIndex is 1-based UI
        if (slotIdx < 0 || slotIdx >= shards.length) continue;
        const shareBytes = shards[slotIdx];
        const envelope = await wrapBytes(shareBytes, target.contactPublicKey);
        await storeEncryptedShard({
          contactId: target.contactId,
          encryptedShard: envelope,
          shardPublicKeyUsed: target.contactPublicKey,
        });
        distributed++;
      }

      setStatus("ok");
      return { contactsDistributed: distributed, threshold };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("error");
      return null;
    } finally {
      if (rawMasterKey) rawMasterKey.fill(0);
    }
  }, [masterKey, me, targets, updateKeeplasShard, storeEncryptedShard]);

  return { distribute, status, error };
}
