"use client";

import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { reconstruct } from "@keeplas/crypto/shamir";
import { wrapBytes, unwrapBytes } from "@keeplas/crypto/kem";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { getStoredShard } from "@/lib/recovery-shard-store";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

export type SubmitStatus =
  | "idle"
  | "no_local_shard"
  | "no_peers"
  | "running"
  | "ok"
  | "error"
  | "already_submitted";

export type ReconstructStatus =
  | "idle"
  | "running"
  | "ok"
  | "error"
  | "missing_shards"
  | "no_local_shard";

interface UseRecoveryFlowArgs {
  contactId: Id<"trusted_contacts">;
  ownerUserId: string;
  accessRequestId: Id<"access_requests"> | null;
}

/**
 * Drives the recovery quorum for a single vault from the contact's side.
 *
 * - submitShard(): unwraps the contact's locally-stored shard, wraps a copy
 *   to every peer's public key, and uploads them via `submitRecoveryShards`.
 *   The server stores envelopes only; raw bytes never leave this device.
 *
 * - reconstructMasterKey(): pulls the wrapped-for-me envelopes from the
 *   server, unwraps each with the contact's private ML-KEM key, combines
 *   the resulting shares with the contact's own raw shard, and runs
 *   Shamir interpolation. Returns the master key bytes on success — the
 *   caller is then free to import them as a CryptoKey for vault decryption.
 */
export function useRecoveryFlow({
  contactId,
  ownerUserId,
  accessRequestId,
}: UseRecoveryFlowArgs) {
  const peers = useQuery(
    api.access_requests.getRecoveryPeers,
    accessRequestId ? { contactId } : "skip"
  );
  const wrappedForMe = useQuery(
    api.access_requests.getRecoveryShardsForMe,
    accessRequestId ? { accessRequestId, contactId } : "skip"
  );
  const submissionCount = useQuery(
    api.access_requests.getRecoverySubmissionCount,
    accessRequestId ? { accessRequestId } : "skip"
  );

  const submitMutation = useAuditedMutation(
    api.access_requests.submitRecoveryShards
  );
  const { ensureOwnerKeypair } = useRecipientCrypto();

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reconstructStatus, setReconstructStatus] =
    useState<ReconstructStatus>("idle");
  const [reconstructError, setReconstructError] = useState<string | null>(null);
  const [masterKeyBytes, setMasterKeyBytes] = useState<Uint8Array | null>(null);

  const submitShard = useCallback(async () => {
    setSubmitError(null);

    if (!accessRequestId) {
      setSubmitError("No active access request");
      setSubmitStatus("error");
      return;
    }

    const stored = await getStoredShard(ownerUserId);
    if (!stored) {
      setSubmitStatus("no_local_shard");
      setSubmitError(
        "No raw shard stored for this vault yet — open this page once while online to receive it."
      );
      return;
    }
    if (!peers || peers.length === 0) {
      setSubmitStatus("no_peers");
      setSubmitError(
        "No other trust contact has published a public key — recovery cannot proceed."
      );
      return;
    }

    setSubmitStatus("running");
    try {
      const submissions = await Promise.all(
        peers.map(async (peer) => ({
          recipientContactId: peer.contactId,
          wrappedShard: await wrapBytes(stored.rawShard, peer.contactPublicKey),
        }))
      );

      await submitMutation({
        accessRequestId,
        submitterContactId: contactId,
        submissions,
      });
      setSubmitStatus("ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already submitted")) {
        setSubmitStatus("already_submitted");
      } else {
        setSubmitError(msg);
        setSubmitStatus("error");
      }
    }
  }, [accessRequestId, contactId, ownerUserId, peers, submitMutation]);

  const reconstructMasterKey = useCallback(async () => {
    setReconstructError(null);

    const stored = await getStoredShard(ownerUserId);
    if (!stored) {
      setReconstructStatus("no_local_shard");
      setReconstructError(
        "No local shard for this vault — cannot reconstruct."
      );
      return null;
    }
    if (!wrappedForMe || wrappedForMe.length === 0) {
      setReconstructStatus("missing_shards");
      setReconstructError(
        "No peer submissions addressed to you yet. Wait for more contacts to submit."
      );
      return null;
    }

    setReconstructStatus("running");
    try {
      const { secretKey } = await ensureOwnerKeypair();
      const peerShares: Uint8Array[] = [];
      for (const row of wrappedForMe) {
        const raw = await unwrapBytes(row.wrappedShard, secretKey);
        peerShares.push(raw);
      }
      const allShares = [stored.rawShard, ...peerShares];

      const masterKey = await reconstruct(allShares);
      setMasterKeyBytes(masterKey);
      setReconstructStatus("ok");
      return masterKey;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setReconstructError(msg);
      setReconstructStatus("error");
      return null;
    }
  }, [ownerUserId, wrappedForMe, ensureOwnerKeypair]);

  return {
    submitShard,
    submitStatus,
    submitError,
    reconstructMasterKey,
    reconstructStatus,
    reconstructError,
    masterKeyBytes,
    submissionCount: submissionCount ?? 0,
    wrappedForMeCount: wrappedForMe?.length ?? 0,
    peerCount: peers?.length ?? 0,
  };
}
