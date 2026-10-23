import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { RowText, StatusChip } from "@/components/v2/surface";
import { useTranslations } from "@/lib/i18n";
import {
  computeVerificationBadge,
  getInitials,
  isAwaitingKey,
  ROLE_LABELS,
  STATUS_CONFIG,
} from "./contact-display";

interface ContactCardProps {
  contact: Doc<"trusted_contacts">;
  onSelect: (contact: Doc<"trusted_contacts">) => void;
}

/** Round navy avatar with the contact's initials (card and detail sheet). */
export function ContactAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-action-primary text-label text-text-inverse">
      {getInitials(name)}
    </span>
  );
}

export function ContactCard({ contact, onSelect }: ContactCardProps) {
  const t = useTranslations("trustedContacts");
  const statusConfig =
    STATUS_CONFIG[contact.invitationStatus] ?? STATUS_CONFIG.pending;
  const isRecipientOnly = (contact.contactType ?? "trust") === "recipient_only";
  const verificationBadge = computeVerificationBadge(contact);
  const roleLabel = ROLE_LABELS[contact.role] ?? "Contact";

  return (
    <button
      type="button"
      onClick={() => onSelect(contact)}
      className="flex w-full flex-col gap-[12px] rounded-md border border-border-default bg-bg-surface p-[14px] text-left transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      {/* Name + primary identifier (email, falling back to phone) */}
      <span className="flex w-full items-center gap-[12px]">
        <ContactAvatar name={contact.name} />
        <RowText
          title={contact.name}
          description={
            <span className="block truncate">
              {contact.email ?? contact.phoneNumber}
            </span>
          }
        />
        <StatusChip
          tone="neutral"
          label={
            isRecipientOnly
              ? t("contactCard.recipient")
              : t("contactCard.trust")
          }
        />
      </span>

      {/* Status, role and verification (details live in the contact sheet) */}
      <span className="flex flex-wrap items-center gap-[8px]">
        <StatusChip
          tone={statusConfig.tone}
          label={statusConfig.label}
          dotClassName={statusConfig.dot}
        />
        <StatusChip tone="neutral" label={roleLabel} />
        {isAwaitingKey(contact) && (
          <StatusChip tone="pending" label={t("contactCard.awaitingKey")} />
        )}
        {verificationBadge && (
          <StatusChip
            tone={verificationBadge.tone}
            label={verificationBadge.label}
            dotClassName={verificationBadge.dot}
          />
        )}
      </span>
    </button>
  );
}
