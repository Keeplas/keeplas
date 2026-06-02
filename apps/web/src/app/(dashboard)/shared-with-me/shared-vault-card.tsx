import { useState } from "react";
import { Link } from "@/lib/navigation";
import { useQuery } from "convex/react";
import { cn, HelpHint } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useTranslations } from "@/lib/i18n";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { useRecoveryFlow } from "./use-recovery-flow";

const ROLE_KEYS: Record<string, string> = {
  family: "family",
  friend: "friend",
  lawyer: "lawyer",
  doctor: "doctor",
  other: "other",
};

interface SharedVault extends Doc<"trusted_contacts"> {
  ownerName: string;
  ownerEmail: string;
  ownerCycleStatus:
    | "running"
    | "awaiting_confirmation"
    | "validated"
    | "triggered"
    | "cancelled"
    | null;
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
  labelKey: string;
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
      labelKey: "card.phase.released",
      pillClass: "bg-primary/10 text-primary",
      dotClass: "bg-primary",
    };
  }
  if (opts.showRecovery) {
    return {
      key: "recovery",
      labelKey: "card.phase.recovery",
      pillClass: "bg-error text-on-error",
      dotClass: "bg-on-error",
    };
  }
  if (opts.canMarkUnreachable) {
    return {
      key: "action_needed",
      labelKey: "card.phase.actionNeeded",
      pillClass: "bg-error-container/60 text-on-error-container",
      dotClass: "bg-error",
    };
  }
  return {
    key: "guarding",
    labelKey: opts.isRecipientOnly
      ? "card.phase.awaitingRelease"
      : "card.phase.guarding",
    pillClass: "bg-surface-container-highest text-on-surface-variant",
    dotClass: "bg-secondary",
  };
}

function formatRelative(
  ts: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return t("card.relative.justNow");
  const min = Math.round(sec / 60);
  if (min < 60) return t("card.relative.minutes", { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("card.relative.hours", { count: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t("card.relative.days", { count: day });
  const month = Math.round(day / 30);
  if (month < 12) return t("card.relative.months", { count: month });
  const year = Math.round(month / 12);
  return t("card.relative.years", { count: year });
}

function isGraceExpired(gracePeriodEndsAt: number | null | undefined): boolean {
  if (!gracePeriodEndsAt) return false;
  return Date.now() > gracePeriodEndsAt;
}

export function SharedVaultCard({ vault }: SharedVaultCardProps) {
  const t = useTranslations("sharedWithMe");
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
      ? t("card.verifiedAt", {
          relative: formatRelative(vault.lastVerifiedAt, t),
        })
      : t("card.verifying");

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
      setUnreachableError(getErrorMessage(err, t("card.actionNeeded.error")));
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
          {t(phase.labelKey)}
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
          {isRecipientOnly ? t("card.type.recipient") : t("card.type.trust")}
        </span>
        <span className="px-2.5 py-0.5 text-label-md rounded-full bg-secondary-container text-on-secondary-container">
          {ROLE_KEYS[vault.role]
            ? t(`card.role.${ROLE_KEYS[vault.role]}`)
            : t("card.role.contact")}
        </span>
      </div>

      {/* Compact custody + verification status (trust contacts only) */}
      {!isRecipientOnly && (
        <div className="flex items-center gap-1.5 mt-4 min-w-0">
          <span className="text-label-md text-on-surface-variant truncate">
            {vault.shardConfirmed
              ? t("card.fragmentHeld", { status: verifiedLabel })
              : t("card.noFragment")}
          </span>
          <HelpHint content={t("card.fragmentHint")} />
        </div>
      )}

      {/* ── Primary action zone, by phase ── */}

      {phase.key === "guarding" && (
        <p className="text-label-md text-on-surface-variant mt-5">
          {isRecipientOnly
            ? t("card.guarding.recipient", { ownerName: vault.ownerName })
            : t("card.guarding.trust", { ownerName: vault.ownerName })}
        </p>
      )}

      {phase.key === "released" && (
        <Link
          href={`/shared-with-me/${vault._id}/memorial`}
          className="vault-gradient text-on-primary flex items-center justify-between gap-3 mt-5 px-4 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
        >
          <span>{t("card.released.cta")}</span>
          <span className="text-label-md opacity-80">
            {vault.releasedItemCount === 1
              ? t("card.released.itemCountOne", {
                  count: vault.releasedItemCount,
                })
              : t("card.released.itemCountOther", {
                  count: vault.releasedItemCount,
                })}{" "}
            →
          </span>
        </Link>
      )}

      {phase.key === "action_needed" && (
        <div className="mt-5 space-y-2">
          <p className="text-label-md text-on-surface-variant inline-flex items-start gap-1.5">
            <span>
              {t("card.actionNeeded.prompt", { ownerName: vault.ownerName })}
            </span>
            <HelpHint content={t("card.actionNeeded.hint")} />
          </p>
          {unreachableState === "confirming" ? (
            <div className="flex gap-2">
              <button
                onClick={handleMarkUnreachable}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer"
              >
                {t("card.actionNeeded.confirm")}
              </button>
              <button
                onClick={() => setUnreachableState("idle")}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-container-high text-on-surface cursor-pointer"
              >
                {t("card.actionNeeded.cancel")}
              </button>
            </div>
          ) : unreachableState === "done" ? (
            <p className="text-label-md text-secondary font-medium">
              {t("card.actionNeeded.done")}
            </p>
          ) : (
            <button
              onClick={handleMarkUnreachable}
              disabled={unreachableState === "running"}
              className="w-full text-sm px-3 py-2 rounded-lg bg-error/10 hover:bg-error/15 text-error font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {unreachableState === "running"
                ? t("card.actionNeeded.submitting")
                : t("card.actionNeeded.mark")}
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
              {t("card.recovery.title")}
              <HelpHint content={t("card.recovery.hint")} />
            </h4>
            <span className="text-label-md text-on-surface-variant">
              {recovery.submissionCount === 1
                ? t("card.recovery.submissionCountOne", {
                    count: recovery.submissionCount,
                  })
                : t("card.recovery.submissionCountOther", {
                    count: recovery.submissionCount,
                  })}
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
                ? t("card.recovery.sealing")
                : t("card.recovery.submit")}
            </button>
          ) : (
            <p className="text-label-md text-secondary font-medium">
              {recovery.peerCount === 1
                ? t("card.recovery.submittedToPeersOne", {
                    count: recovery.peerCount,
                  })
                : t("card.recovery.submittedToPeersOther", {
                    count: recovery.peerCount,
                  })}
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
                  {t("card.recovery.reconstructed")}
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
                    ? t("card.recovery.reconstructing")
                    : recovery.wrappedForMeCount === 0
                      ? t("card.recovery.awaitingPeers")
                      : t("card.recovery.reconstruct")}
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
