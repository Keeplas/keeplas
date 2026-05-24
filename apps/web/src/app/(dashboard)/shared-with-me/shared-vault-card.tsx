"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { cn, HelpHint } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
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

type PhaseKey = "guarding" | "action_needed" | "recovery" | "released";

interface Phase {
  key: PhaseKey;
  label: string;
  pillClass: string;
  dotClass: string;
}

/**
 * Collapse the contact's many possible states into ONE lifecycle phase so the
 * card can foreground a single status + primary action. Precedence is
 * most-advanced-wins: released > recovery > action needed > guarding. (Recovery
 * can still co-exist with released — it's then shown as a secondary action.)
 */
function getVaultPhase(opts: {
  released: boolean;
  showRecovery: boolean;
  canMarkUnreachable: boolean;
  isRecipientOnly: boolean;
}): Phase {
  if (opts.released) {
    return {
      key: "released",
      label: "Released",
      pillClass: "bg-primary/10 text-primary",
      dotClass: "bg-primary",
    };
  }
  if (opts.showRecovery) {
    return {
      key: "recovery",
      label: "Recovery",
      pillClass: "bg-error text-on-error",
      dotClass: "bg-on-error",
    };
  }
  if (opts.canMarkUnreachable) {
    return {
      key: "action_needed",
      label: "Action needed",
      pillClass: "bg-error-container/60 text-on-error-container",
      dotClass: "bg-error",
    };
  }
  return {
    key: "guarding",
    label: opts.isRecipientOnly ? "Awaiting release" : "Guarding",
    pillClass: "bg-surface-container-highest text-on-surface-variant",
    dotClass: "bg-secondary",
  };
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

  const isAwaitingConfirmation =
    vault.ownerCycleStatus === "awaiting_confirmation";
  const canMarkUnreachable =
    !isRecipientOnly && isAccepted && isAwaitingConfirmation;

  const graceExpired = isGraceExpired(activeRequest?.gracePeriodEndsAt);
  const showRecovery =
    !isRecipientOnly &&
    isAccepted &&
    !!activeRequest?.quorumReached &&
    !activeRequest?.cancelledDuringGrace &&
    graceExpired;
  const recoveryComplete = recovery.reconstructStatus === "ok";

  const phase = getVaultPhase({
    released: vault.released,
    showRecovery,
    canMarkUnreachable,
    isRecipientOnly,
  });

  // Recovery surfaces as the primary action in its own phase, and as a
  // secondary action under the memorial link once released — collapsed once the
  // master key is reconstructed so the memorial stays the focus.
  const showRecoveryBlock =
    showRecovery && !(phase.key === "released" && recoveryComplete);

  const initials = vault.ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Verification is automatic: useReceiveShard unwraps the real shard on load
  // and stamps lastVerifiedAt. The label just reflects that server state.
  const verifiedLabel =
    vault.lastVerifiedAt !== undefined
      ? `Verified ${formatRelative(vault.lastVerifiedAt)}`
      : "Verifying…";

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

  return (
    <div className="bg-surface-container-low p-6 rounded-2xl group hover:bg-surface-container transition-all">
      {/* Header: identity + the single phase chip */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-secondary p-0.5 shrink-0">
          <div className="w-full h-full rounded-full bg-primary-container flex items-center justify-center">
            <span className="text-label-md text-on-primary-container">
              {initials}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-md shrink-0",
            phase.pillClass,
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", phase.dotClass)} />
          {phase.label}
        </span>
      </div>

      <h3 className="text-headline-sm text-primary">{vault.ownerName}</h3>
      <p className="text-body-md text-on-surface-variant truncate">
        {vault.ownerEmail}
      </p>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <span
          className={cn(
            "px-2.5 py-0.5 text-label-md rounded-full",
            isRecipientOnly
              ? "bg-surface-container-high text-on-surface-variant"
              : "bg-primary/10 text-primary",
          )}
        >
          {isRecipientOnly ? "Recipient" : "Trust"}
        </span>
        <span className="px-2.5 py-0.5 text-label-md rounded-full bg-secondary-container text-on-secondary-container">
          {ROLE_LABELS[vault.role] ?? "Contact"}
        </span>
      </div>

      {/* Compact custody + verification status (trust contacts only) */}
      {!isRecipientOnly && (
        <div className="flex items-center gap-1.5 mt-4 min-w-0">
          <span className="text-label-md text-on-surface-variant truncate">
            {vault.shardConfirmed
              ? `Fragment held · ${verifiedLabel}`
              : "No fragment yet"}
          </span>
          <HelpHint content="An encrypted recovery fragment of this vault is sealed to your public key and stored on this device. With the other trust contacts (threshold set by the owner) you can help reopen the vault — alone you cannot. It re-verifies automatically each time you open this page, so the owner knows you can still unwrap it." />
        </div>
      )}

      {/* ── Primary action zone, by phase ── */}

      {phase.key === "guarding" && (
        <p className="text-label-md text-on-surface-variant mt-5">
          {isRecipientOnly
            ? `You'll receive what ${vault.ownerName} left you here if their vault is ever released.`
            : `Nothing to do for now — you'll be asked to help only if ${vault.ownerName} stops responding to their check-ins.`}
        </p>
      )}

      {phase.key === "released" && (
        <Link
          href={`/shared-with-me/${vault._id}/memorial`}
          className="vault-gradient text-on-primary flex items-center justify-between gap-3 mt-5 px-4 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
        >
          <span>View memorial vault</span>
          <span className="text-label-md opacity-80">
            {vault.releasedItemCount} item
            {vault.releasedItemCount === 1 ? "" : "s"} →
          </span>
        </Link>
      )}

      {phase.key === "action_needed" && (
        <div className="mt-5 space-y-2">
          <p className="text-label-md text-on-surface-variant inline-flex items-start gap-1.5">
            <span>
              {vault.ownerName} stopped responding to their check-ins. If you
              genuinely can&apos;t reach them, confirm it.
            </span>
            <HelpHint content="Two trust contacts must confirm before a 72-hour grace window opens. During that window the owner can still cancel by checking in. Only after it passes can the vault be recovered/released." />
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
                ? "Submitting…"
                : "Mark as unreachable"}
            </button>
          )}
          {unreachableState === "error" && unreachableError && (
            <p className="text-label-md text-error">{unreachableError}</p>
          )}
        </div>
      )}

      {/* Recovery: primary in its phase, secondary under the memorial link */}
      {showRecoveryBlock && (
        <div
          className={cn(
            "space-y-3",
            phase.key === "released"
              ? "pt-4 mt-4 border-t border-outline-variant/15"
              : "mt-5",
          )}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-label-md font-bold uppercase tracking-wide text-error inline-flex items-center gap-2">
              Recovery in progress
              <HelpHint content="The 72h grace window passed without the owner cancelling. You and the other trust contacts can now submit your shards. Once the threshold is reached, any submitter can reconstruct the master key entirely on-device — the server never sees raw shards." />
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
