"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { cn, HelpHint } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { useVerifyShard } from "./use-verify-shard";
import { useRecoveryFlow } from "./use-recovery-flow";

const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Legal",
  doctor: "Medical",
  other: "Other",
};

interface SharedVault extends Doc<"trusted_contacts"> {
  ownerName: string;
  ownerEmail: string;
  ownerCycleStatus:
    | "running"
    | "awaiting_confirmation"
    | "validated"
    | "escalating"
    | "triggered"
    | "cancelled"
    | null;
  ownerCycleEscalatedAt: number | null;
  // The owner's vault has been released to this contact (an approved
  // access_request exists) — gates the "View memorial vault" entry point.
  released: boolean;
  releasedItemCount: number;
}

interface SharedVaultCardProps {
  vault: SharedVault;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.round(month / 12);
  return `${year}y ago`;
}

function isGraceExpired(gracePeriodEndsAt: number | null | undefined): boolean {
  if (!gracePeriodEndsAt) return false;
  return Date.now() > gracePeriodEndsAt;
}

export function SharedVaultCard({ vault }: SharedVaultCardProps) {
  const { verify, status, error } = useVerifyShard();
  const markUnreachable = useAuditedMutation(
    api.access_requests.markUserUnreachable,
  );
  const activeRequest = useQuery(
    api.access_requests.getActiveAccessRequestForContact,
    vault.invitationStatus === "accepted"
      ? { contactId: vault._id as Id<"trusted_contacts"> }
      : "skip",
  );

  const recovery = useRecoveryFlow({
    contactId: vault._id as Id<"trusted_contacts">,
    ownerUserId: vault.userId as unknown as string,
    accessRequestId: activeRequest?._id ?? null,
  });

  const [unreachableState, setUnreachableState] = useState<
    "idle" | "confirming" | "running" | "done" | "error"
  >("idle");
  const [unreachableError, setUnreachableError] = useState<string | null>(null);

  const isRecipientOnly = (vault.contactType ?? "trust") === "recipient_only";
  const isAccepted = vault.invitationStatus === "accepted";
  const hasEnvelope = !!vault.verificationEnvelope;
  const hasKey = !!vault.contactPublicKey;
  const canVerify = hasEnvelope && hasKey && status !== "running";
  // Mark-as-unreachable only surfaces once the owner's Life Check has escalated
  // to the contact-confirmation stage (every check-in went unanswered). Outside
  // that stage the action is hidden — contacts can't fire it speculatively.
  const isAwaitingConfirmation =
    vault.ownerCycleStatus === "awaiting_confirmation";
  const canMarkUnreachable =
    !isRecipientOnly && isAccepted && isAwaitingConfirmation;

  // Recovery section is surfaced once the unreachability quorum has been
  // reached AND the 72h grace window has expired without cancellation.
  const graceExpired = isGraceExpired(activeRequest?.gracePeriodEndsAt);
  const showRecovery =
    !isRecipientOnly &&
    isAccepted &&
    !!activeRequest?.quorumReached &&
    !activeRequest?.cancelledDuringGrace &&
    graceExpired;
  const initials = vault.ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleVerify() {
    await verify({
      contactId: vault._id as Id<"trusted_contacts">,
      verificationEnvelope: vault.verificationEnvelope,
    });
  }

  async function handleMarkUnreachable() {
    if (unreachableState !== "confirming") {
      setUnreachableState("confirming");
      return;
    }
    setUnreachableState("running");
    setUnreachableError(null);
    try {
      await markUnreachable({ contactId: vault._id as Id<"trusted_contacts"> });
      setUnreachableState("done");
    } catch (err) {
      setUnreachableError(
        getErrorMessage(err, "Could not confirm unreachability."),
      );
      setUnreachableState("error");
    }
  }

  const lastVerifiedLabel =
    vault.lastVerifiedAt !== undefined
      ? `Verified ${formatRelative(vault.lastVerifiedAt)}`
      : "Not yet verified";

  const buttonLabel =
    status === "running"
      ? "Verifying..."
      : status === "ok"
        ? "Shard verified ✓"
        : !hasKey
          ? "Awaiting key"
          : !hasEnvelope
            ? "Verification not ready"
            : "Verify my shard";

  return (
    <div className="bg-surface-container-low p-6 rounded-2xl group hover:bg-surface-container transition-all">
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-full border-2 border-secondary p-0.5">
          <div className="w-full h-full rounded-full bg-primary-container flex items-center justify-center">
            <span className="text-label-md text-on-primary-container">
              {initials}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-3 py-1 text-label-md rounded-full",
              isRecipientOnly
                ? "bg-surface-container-high text-on-surface-variant"
                : "bg-primary/10 text-primary",
            )}
          >
            {isRecipientOnly ? "Recipient" : "Trust"}
          </span>
          <span className="px-3 py-1 text-label-md rounded-full bg-secondary-container text-on-secondary-container">
            {ROLE_LABELS[vault.role] ?? "Contact"}
          </span>
        </div>
      </div>

      <h3 className="text-headline-sm text-primary">{vault.ownerName}</h3>
      <p className="text-body-md text-on-surface-variant mb-5 truncate">
        {vault.ownerEmail}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-5">
        {vault.shardConfirmed && (
          <span className="text-label-md px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container inline-flex items-center gap-1.5">
            Fragment Held
            <HelpHint content="An encrypted recovery fragment of this vault is sealed to your public key and stored on this device. Together with the other trust contacts (recovery threshold set by the owner), you can help reopen the vault — alone you cannot." />
          </span>
        )}
      </div>

      {vault.released && (
        <Link
          href={`/shared-with-me/${vault._id}/memorial`}
          className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl bg-primary text-on-primary font-medium hover:opacity-90 transition-opacity"
        >
          <span>View memorial vault</span>
          <span className="text-label-md opacity-80">
            {vault.releasedItemCount} item
            {vault.releasedItemCount === 1 ? "" : "s"} →
          </span>
        </Link>
      )}

      {!isRecipientOnly && (
        <div className="pt-5 border-t border-outline-variant/15 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">
              {lastVerifiedLabel}
            </span>
            <button
              onClick={handleVerify}
              disabled={!canVerify}
              className="text-body-md font-bold text-secondary hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
            >
              {buttonLabel}
            </button>
          </div>
          {status === "error" && error && (
            <p className="text-label-md text-error">{error}</p>
          )}
          {status === "ok" && (
            <p className="text-label-md text-on-surface-variant">
              Your keypair unwrapped the test envelope correctly. The vault
              owner will see this confirmation.
            </p>
          )}
          {!hasKey && (
            <p className="text-label-md text-on-surface-variant">
              The vault owner provisions your verification key after you accept
              your invitation. Check back later.
            </p>
          )}
          {hasKey && !hasEnvelope && (
            <p className="text-label-md text-on-surface-variant">
              The vault owner hasn&apos;t enabled verification on their side
              yet.
            </p>
          )}
        </div>
      )}

      {canMarkUnreachable && (
        <div className="pt-5 mt-5 border-t border-outline-variant/15 space-y-2">
          <p className="text-label-md text-on-surface-variant">
            If you genuinely cannot reach {vault.ownerName} and Life Check has
            already escalated, you can confirm they are unreachable. Two trust
            contacts must confirm before the 72h grace window opens.
          </p>
          {unreachableState === "confirming" ? (
            <div className="flex gap-2">
              <button
                onClick={handleMarkUnreachable}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer"
              >
                Confirm — they are unreachable
              </button>
              <button
                onClick={() => setUnreachableState("idle")}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-container-high text-on-surface cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : unreachableState === "done" ? (
            <p className="text-label-md text-secondary font-medium">
              Confirmation recorded. Other trust contacts will be notified.
            </p>
          ) : (
            <button
              onClick={handleMarkUnreachable}
              disabled={unreachableState === "running"}
              className="w-full text-sm px-3 py-2 rounded-lg bg-error/10 hover:bg-error/15 text-error font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {unreachableState === "running"
                ? "Submitting..."
                : "Mark as unreachable"}
            </button>
          )}
          {unreachableState === "error" && unreachableError && (
            <p className="text-label-md text-error">{unreachableError}</p>
          )}
        </div>
      )}

      {showRecovery && (
        <div className="pt-5 mt-5 border-t border-outline-variant/15 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-label-md font-bold uppercase tracking-wide text-error inline-flex items-center gap-2">
              Recovery in progress
              <HelpHint content="The 72h grace window passed without the vault owner cancelling. You and the other trust contacts can now submit your shards. Once the threshold is reached, any submitter can reconstruct the master key entirely on-device — the server never sees raw shards." />
            </h4>
            <span className="text-label-md text-on-surface-variant">
              {recovery.submissionCount} submission
              {recovery.submissionCount === 1 ? "" : "s"}
            </span>
          </div>

          {recovery.submitStatus !== "ok" &&
          recovery.submitStatus !== "already_submitted" ? (
            <button
              onClick={() => void recovery.submitShard()}
              disabled={recovery.submitStatus === "running"}
              className="w-full text-sm px-3 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
            >
              {recovery.submitStatus === "running"
                ? "Sealing your shard for peers…"
                : "Submit my shard"}
            </button>
          ) : (
            <p className="text-label-md text-secondary font-medium">
              Your shard was submitted to {recovery.peerCount} peer
              {recovery.peerCount === 1 ? "" : "s"}.
            </p>
          )}

          {recovery.submitStatus === "error" && recovery.submitError && (
            <p className="text-label-md text-error">{recovery.submitError}</p>
          )}
          {recovery.submitStatus === "no_local_shard" && (
            <p className="text-label-md text-error">{recovery.submitError}</p>
          )}

          {(recovery.submitStatus === "ok" ||
            recovery.submitStatus === "already_submitted") && (
            <div className="pt-2">
              {recovery.reconstructStatus === "ok" ? (
                <p className="text-label-md text-secondary font-medium">
                  Master key reconstructed on this device. Memorial vault access
                  available.
                </p>
              ) : (
                <button
                  onClick={() => void recovery.reconstructMasterKey()}
                  disabled={
                    recovery.reconstructStatus === "running" ||
                    recovery.wrappedForMeCount === 0
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg bg-primary text-on-primary font-medium cursor-pointer disabled:opacity-60"
                >
                  {recovery.reconstructStatus === "running"
                    ? "Reconstructing…"
                    : recovery.wrappedForMeCount === 0
                      ? "Awaiting peer submissions…"
                      : "Reconstruct master key"}
                </button>
              )}
              {recovery.reconstructStatus === "error" &&
                recovery.reconstructError && (
                  <p className="text-label-md text-error mt-2">
                    {recovery.reconstructError}
                  </p>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
