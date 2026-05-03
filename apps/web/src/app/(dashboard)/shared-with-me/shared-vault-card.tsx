"use client";

import { useState } from "react";
import { cn } from "@keeplas/ui";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { useVerifyShard } from "./use-verify-shard";

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
    | "validated"
    | "escalating"
    | "triggered"
    | "cancelled"
    | null;
  ownerCycleEscalatedAt: number | null;
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

export function SharedVaultCard({ vault }: SharedVaultCardProps) {
  const { verify, status, error } = useVerifyShard();
  const markUnreachable = useAuditedMutation(
    api.access_requests.markUserUnreachable
  );

  const [unreachableState, setUnreachableState] = useState<
    "idle" | "confirming" | "running" | "done" | "error"
  >("idle");
  const [unreachableError, setUnreachableError] = useState<string | null>(null);

  const isRecipientOnly = (vault.contactType ?? "trust") === "recipient_only";
  const isAccepted = vault.invitationStatus === "accepted";
  const hasEnvelope = !!vault.verificationEnvelope;
  const hasKey = !!vault.contactPublicKey;
  const canVerify = hasEnvelope && hasKey && status !== "running";
  // Mark-as-unreachable only surfaces once the owner's Life Check has actually
  // escalated past the inactivity threshold. Outside escalation the action is
  // hidden — contacts shouldn't be able to fire it speculatively.
  const isOwnerEscalating = vault.ownerCycleStatus === "escalating";
  const canMarkUnreachable = !isRecipientOnly && isAccepted && isOwnerEscalating;
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
      setUnreachableError(err instanceof Error ? err.message : String(err));
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
                : "bg-primary/10 text-primary"
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
        {!isRecipientOnly && typeof vault.shardIndex === "number" && (
          <span className="text-label-md px-3 py-1.5 rounded-lg bg-primary/5 text-primary">
            Shard {vault.shardIndex} of 5
          </span>
        )}
        {vault.shardConfirmed && (
          <span className="text-label-md px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container">
            Fragment Held
          </span>
        )}
      </div>

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
              The vault owner hasn&apos;t enabled verification on their side yet.
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
    </div>
  );
}
