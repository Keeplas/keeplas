"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  cn,
  HelpHint,
  Icon,
  Loader,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { getCategoryConfig } from "@/lib/vault-categories";
import {
  computeVerificationBadge,
  formatRelative,
  getInitials,
  ROLE_LABELS,
  STATUS_CONFIG,
} from "./contact-display";

// How an item reaches this contact, mirroring vault_items.recipientMode.
const RECIPIENT_MODE_KEYS: Record<string, string> = {
  explicit: "explicit",
  groups: "groups",
  default: "default",
};

interface ContactDetailSheetProps {
  contact: Doc<"trusted_contacts"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailSheet({
  contact,
  open,
  onOpenChange,
}: ContactDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-full max-w-md bg-surface-container-low"
      >
        {/* Keyed remount resets the body's transient action state per contact. */}
        {contact && (
          <ContactDetailBody
            key={contact._id}
            contact={contact}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ContactDetailBody({
  contact,
  onClose,
}: {
  contact: Doc<"trusted_contacts">;
  onClose: () => void;
}) {
  const t = useTranslations("trustedContacts");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  const revokeContact = useAuditedMutation(api.trusted_contacts.revokeContact);
  const resendInvitation = useAuditedMutation(
    api.trusted_contacts.resendInvitation,
  );

  const summary = useQuery(api.trusted_contacts.getContactAccessSummary, {
    contactId: contact._id,
  });

  async function handleRevoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    try {
      await revokeContact({ contactId: contact._id });
      onClose();
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      await resendInvitation({ contactId: contact._id });
      setResentAt(Date.now());
    } finally {
      setResending(false);
    }
  }

  const isRecipientOnly = (contact.contactType ?? "trust") === "recipient_only";
  const statusConfig =
    STATUS_CONFIG[contact.invitationStatus] ?? STATUS_CONFIG.pending;
  const verificationBadge = computeVerificationBadge(contact);
  const canManage =
    contact.invitationStatus === "accepted" ||
    contact.invitationStatus === "pending";

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-11 h-11 rounded-full border-2 p-0.5 shrink-0",
              statusConfig.avatarBorder,
            )}
          >
            <div className="w-full h-full rounded-full bg-primary-container flex items-center justify-center">
              <span className="text-label-md text-on-primary-container">
                {getInitials(contact.name)}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate">{contact.name}</SheetTitle>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "px-2 py-0.5 text-label-md rounded-full",
                  isRecipientOnly
                    ? "bg-surface-container-high text-on-surface-variant"
                    : "bg-primary/10 text-primary",
                )}
              >
                {isRecipientOnly
                  ? t("contactCard.recipient")
                  : t("contactCard.trust")}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 text-label-md rounded-full",
                  statusConfig.className,
                )}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
        <SheetClose
          aria-label={t("detail.close")}
          className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer shrink-0"
        >
          <Icon path={ICON_PATHS.close} className="w-5 h-5" />
        </SheetClose>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {/* Details */}
        <section>
          <SectionLabel>{t("detail.details")}</SectionLabel>
          <dl className="space-y-2.5">
            {contact.email && (
              <DetailRow label={t("detail.email")} value={contact.email} />
            )}
            {contact.phoneNumber && (
              <DetailRow
                label={t("detail.phone")}
                value={contact.phoneNumber}
              />
            )}
            <DetailRow
              label={t("detail.role")}
              value={ROLE_LABELS[contact.role] ?? "Contact"}
            />
            <DetailRow
              label={t("detail.invited")}
              value={formatRelative(contact.invitedAt)}
            />
            {contact.acceptedAt && (
              <DetailRow
                label={t("detail.accepted")}
                value={formatRelative(contact.acceptedAt)}
              />
            )}
          </dl>
        </section>

        {/* Recovery role */}
        <section>
          <SectionLabel>{t("detail.recoveryRole")}</SectionLabel>
          {isRecipientOnly ? (
            <p className="text-body-md text-on-surface-variant">
              {t("detail.recipientOnlyDescription")}
            </p>
          ) : (
            <div className="space-y-3">
              {typeof contact.shardIndex === "number" && (
                <dl>
                  <DetailRow
                    label={t("detail.shardIndex")}
                    value={`#${contact.shardIndex}`}
                  />
                </dl>
              )}
              {(contact.shardConfirmed || verificationBadge) && (
                <div className="flex flex-wrap items-center gap-2">
                  {contact.shardConfirmed && (
                    <span className="text-label-md px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container inline-flex items-center gap-1.5">
                      {t("detail.fragmentAssigned")}
                      <HelpHint content={t("detail.fragmentAssignedHelp")} />
                    </span>
                  )}
                  {verificationBadge && (
                    <span
                      className={cn(
                        "text-label-md px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5",
                        verificationBadge.className,
                      )}
                    >
                      {verificationBadge.label}
                      <HelpHint
                        content={
                          <>
                            <p>{t("detail.verificationHelp")}</p>
                            {verificationBadge.lastVerifiedAt !== undefined && (
                              <p className="mt-2">
                                {t("detail.lastVerified", {
                                  relative: formatRelative(
                                    verificationBadge.lastVerifiedAt,
                                  ),
                                  date: new Date(
                                    verificationBadge.lastVerifiedAt,
                                  ).toLocaleDateString(),
                                })}
                              </p>
                            )}
                          </>
                        }
                      />
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Items released to this contact */}
        <section>
          <SectionLabel>{t("detail.itemsReleased")}</SectionLabel>
          {summary === undefined ? (
            <Loader size="sm" />
          ) : summary.releasedItems.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              {t("detail.noItemsRouted")}
            </p>
          ) : (
            <ul className="space-y-2">
              {summary.releasedItems.map((item) => (
                <li key={item._id}>
                  <Link
                    href={`/vault/${item._id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-outline-variant/15 hover:bg-surface-container transition-colors"
                  >
                    <Icon
                      path={getCategoryConfig(item.category).icon}
                      className="w-4 h-4 text-secondary shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface truncate">
                        {item.title}
                      </p>
                      <p className="text-label-md text-on-surface-variant">
                        {getCategoryConfig(item.category).label} ·{" "}
                        {t(
                          `detail.recipientMode.${RECIPIENT_MODE_KEYS[item.recipientMode]}`,
                        )}
                      </p>
                    </div>
                    <Icon
                      path={ICON_PATHS.chevronRight}
                      className="w-3.5 h-3.5 text-on-surface-variant shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Release groups */}
        <section>
          <SectionLabel>{t("detail.releaseGroups")}</SectionLabel>
          {summary === undefined ? (
            <Loader size="sm" />
          ) : summary.memberGroups.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              {t("detail.notMemberOfGroup")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {summary.memberGroups.map((g) => (
                <span
                  key={g._id}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface text-label-md"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {canManage && (
        <div className="px-6 py-4 border-t border-outline-variant/10 space-y-2">
          {contact.invitationStatus === "pending" && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full text-body-md font-bold text-secondary px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending
                ? t("detail.resending")
                : resentAt
                  ? t("detail.invitationResent")
                  : t("detail.resendInvitation")}
            </button>
          )}
          {confirmRevoke ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 text-body-md px-3 py-2.5 rounded-xl bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
              >
                {revoking ? t("detail.revoking") : t("detail.confirmRevoke")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="flex-1 text-body-md px-3 py-2.5 rounded-xl bg-surface-container-high text-on-surface cursor-pointer"
              >
                {t("detail.cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRevoke}
              className="w-full text-left text-body-md text-error px-3 py-2.5 rounded-xl hover:bg-error/10 transition-colors cursor-pointer"
            >
              {t("detail.revokeContact")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-label-md uppercase tracking-wider text-on-surface-variant mb-3">
      {children}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-body-md text-on-surface-variant shrink-0">{label}</dt>
      <dd className="text-body-md text-on-surface text-right truncate">
        {value}
      </dd>
    </div>
  );
}
