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
import {
  verifyContactKey,
  type BlockedContact,
} from "@/lib/verify-contact-key";
import { useBlockedWrapAlert } from "@/lib/use-blocked-wrap-alert";
import type { Id } from "@keeplas/backend/_generated/dataModel";

/**
 * Minimum trust contacts required before recovery shards can be distributed.
 * Mirrors the backend floor in packages/convex/trusted_contacts.ts (Convex
 * constants can't be imported into the web build). A single guardian is a
 * broken setup: no peer to exchange shards with, quorum unreachable.
 */
export const MIN_TRUST_CONTACTS_FOR_RECOVERY = 2;

export type DistributeStatus =
  | "idle"
  | "running"
  | "ok"
  | "error"
  | "missing_master_key"
  | "no_targets"
  | "insufficient_contacts";

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
 * Flow: split (4 shares: device + 3 contacts) → device shard to localStorage
 * → for each contact, wrap their slot's share to their public key and store
 * via storeEncryptedShard. The server holds NO shard (finding #3): a
 * server-held shard plus one contact shard would reach a threshold-2 quorum
 * and let a malicious server reconstruct the master key, breaking ZK.
 */
export function useDistributeShards(): {
  distribute: () => Promise<DistributeResult | null>;
  status: DistributeStatus;
  error: string | null;
} {
  const { masterKey } = useMasterKey();
  const me = useQuery(api.onboarding.getOnboardingState);
  const targets = useQuery(api.trusted_contacts.getDistributionTargets);
  const storeEncryptedShard = useAuditedMutation(
    api.trusted_contacts.storeEncryptedShard,
  );
  const pinContactIdentity = useAuditedMutation(
    api.trusted_contacts.pinContactIdentity,
  );
  const showBlockedWrapAlert = useBlockedWrapAlert();

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
    if (targets.length < MIN_TRUST_CONTACTS_FOR_RECOVERY) {
      setStatus("insufficient_contacts");
      setError(
        "Recovery needs at least 2 trusted contacts. Invite and confirm one more before distributing.",
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

      // Re-split: 4 total shares, current threshold. Slots:
      //   shards[0] → device (localStorage)
      //   shards[1..3] → trust contacts at shardIndex 2..4
      // The server holds NO shard (finding #3).
      const shards = await split(rawMasterKey, 4, threshold);

      try {
        localStorage.setItem(
          STORAGE_KEYS.deviceShard,
          uint8ToBase64(shards[0]),
        );
      } catch {
        // Private mode etc — non-fatal; the contact shards alone satisfy the
        // threshold without the device shard.
      }

      // Verify-before-wrap (finding #2): authenticate EVERY target's encryption
      // key before wrapping a shard to it, and pin on first trust. If any target
      // can't be verified we BLOCK the whole distribution — a partial shard set
      // could silently exclude a contact or hand a shard to a server-substituted
      // key. The owner may explicitly re-pin a deliberate change and retry.
      const verifyAll = async (): Promise<BlockedContact[]> => {
        const failures: BlockedContact[] = [];
        for (const target of targets) {
          const outcome = await verifyContactKey(target);
          if (outcome.status !== "ok") {
            failures.push({
              contactId: target.contactId,
              name: target.name,
              reason: outcome.status,
              newFingerprint:
                outcome.status === "fingerprint_changed"
                  ? outcome.newFingerprint
                  : undefined,
            });
          } else if (outcome.pinFingerprint) {
            await pinContactIdentity({
              contactId: target.contactId as Id<"trusted_contacts">,
              fingerprint: outcome.pinFingerprint,
            });
          }
        }
        return failures;
      };

      let failures = await verifyAll();
      if (failures.length > 0) {
        const retry = await showBlockedWrapAlert(failures);
        if (!retry) {
          setStatus("error");
          setError("Shard distribution blocked: a contact's key isn't trusted.");
          return null;
        }
        failures = await verifyAll();
        if (failures.length > 0) {
          await showBlockedWrapAlert(failures);
          setStatus("error");
          setError("Shard distribution blocked: a contact's key isn't trusted.");
          return null;
        }
      }

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
  }, [
    masterKey,
    me,
    targets,
    storeEncryptedShard,
    pinContactIdentity,
    showBlockedWrapAlert,
  ]);

  return { distribute, status, error };
}
