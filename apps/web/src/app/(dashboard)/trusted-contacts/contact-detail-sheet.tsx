import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  Button,
  HelpHint,
  Icon,
  Loader,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@keeplas/ui";
import { ListRow } from "@/components/v2/list-row";
import { StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { getCategoryConfig } from "@/lib/vault-categories";
import { useCategoryLabel } from "@/lib/use-categories";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { useItemCategories } from "@/lib/use-item-categories";
import { ContactAvatar } from "./contact-card";
import {
  computeVerificationBadge,
  formatRelative,
  isAwaitingKey,
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
        overlayClassName="bg-scrim backdrop-blur-none"
        className="flex w-full max-w-md flex-col border-l border-border-default bg-bg-surface shadow-none"
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
  const categoryLabel = useCategoryLabel();
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
  const titles = useDecryptedTitles(summary?.releasedItems);
  const categories = useItemCategories(summary?.releasedItems);

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

  const statusConfig =
    STATUS_CONFIG[contact.invitationStatus] ?? STATUS_CONFIG.pending;
  const verificationBadge = computeVerificationBadge(contact);
  const canManage =
    contact.invitationStatus === "accepted" ||
    contact.invitationStatus === "pending";

  return (
    <>
      <div className="flex items-center gap-[12px] border-b border-border-default px-[24px] py-[20px]">
        <ContactAvatar name={contact.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <SheetTitle className="truncate text-h2 text-text-primary">
            {contact.name}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-[6px]">
            <StatusChip
              tone={statusConfig.tone}
              label={statusConfig.label}
              dotClassName={statusConfig.dot}
            />
          </div>
        </div>
        <SheetClose
          aria-label={t("detail.close")}
          className="-m-[4px] size-[30px] shrink-0 rounded-xs p-[4px] text-text-muted hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <Icon path={ICON_PATHS.close} className="size-[22px]" />
        </SheetClose>
      </div>

      <div className="flex flex-1 flex-col gap-[24px] overflow-y-auto p-[24px]">
        {/* Details */}
        <section>
          <SectionLabel>{t("detail.details")}</SectionLabel>
          <dl className="flex flex-col gap-[10px]">
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
          <div className="flex flex-col items-start gap-[8px]">
            {verificationBadge && (
              <span className="inline-flex items-center gap-[6px]">
                <StatusChip
                  tone={verificationBadge.tone}
                  label={verificationBadge.label}
                  dotClassName={verificationBadge.dot}
                />
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
            {isAwaitingKey(contact) && (
              <span className="inline-flex items-center gap-[6px]">
                <StatusChip tone="pending" label={t("detail.awaitingKey")} />
                <HelpHint content={t("detail.awaitingKeyHelp")} />
              </span>
            )}
          </div>
        </section>

        {/* Items released to this contact */}
        <section>
          <SectionLabel>{t("detail.itemsReleased")}</SectionLabel>
          {summary === undefined ? (
            <Loader size="sm" />
          ) : summary.releasedItems.length === 0 ? (
            <p className="text-body-sm text-text-muted">
              {t("detail.noItemsRouted")}
            </p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {summary.releasedItems.map((item) => (
                <li key={item._id}>
                  <ListRow
                    href={`/vault/${item._id}`}
                    icon={
                      getCategoryConfig(categories[item._id] ?? "other").icon
                    }
                    title={titles[item._id] ?? ""}
                    description={`${categoryLabel(categories[item._id] ?? "other")} · ${t(
                      `detail.recipientMode.${RECIPIENT_MODE_KEYS[item.recipientMode]}`,
                    )}`}
                  />
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
            <p className="text-body-sm text-text-muted">
              {t("detail.notMemberOfGroup")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-[8px]">
              {summary.memberGroups.map((g) => (
                <StatusChip key={g._id} tone="neutral" label={g.name} />
              ))}
            </div>
          )}
        </section>
      </div>

      {canManage && (
        <div className="flex flex-col gap-[8px] border-t border-border-default px-[24px] py-[16px]">
          {contact.invitationStatus === "pending" && (
            <Button
              variant="bordered"
              size="regular"
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending
                ? t("detail.resending")
                : resentAt
                  ? t("detail.invitationResent")
                  : t("detail.resendInvitation")}
            </Button>
          )}
          {confirmRevoke ? (
            <div className="flex gap-[8px]">
              <Button
                variant="danger"
                size="regular"
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1"
              >
                {revoking ? t("detail.revoking") : t("detail.confirmRevoke")}
              </Button>
              <Button
                variant="plain"
                size="regular"
                onClick={() => setConfirmRevoke(false)}
                className="flex-1"
              >
                {t("detail.cancel")}
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="regular"
              onClick={handleRevoke}
              className="w-full"
            >
              {t("detail.revokeContact")}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-[12px] text-label text-text-primary">{children}</h3>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[16px]">
      <dt className="shrink-0 text-body-sm text-text-muted">{label}</dt>
      <dd className="truncate text-right text-body-sm text-text-primary">
        {value}
      </dd>
    </div>
  );
}
