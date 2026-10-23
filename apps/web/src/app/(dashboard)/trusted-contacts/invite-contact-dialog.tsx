import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Button,
  cn,
  HelpHint,
  Input,
  isValidEmail,
  isValidPhone,
  PhoneInput,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectItem,
} from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import { RowText } from "@/components/v2/surface";
import { Field } from "@/components/vault/form-fields";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const ROLES = [
  { value: "family", key: "family" },
  { value: "friend", key: "friend" },
  { value: "lawyer", key: "lawyer" },
  { value: "doctor", key: "doctor" },
  { value: "other", key: "other" },
] as const;

const CONTACT_TYPES = [
  { value: "trust", key: "trustOption" },
  { value: "recipient_only", key: "recipientOption" },
] as const;

type Role = (typeof ROLES)[number]["value"];
type ContactType = (typeof CONTACT_TYPES)[number]["value"];

/** Field label with a help hint (same look as `Field`'s label). */
const LABEL =
  "flex items-center gap-[6px] text-[13px] leading-[18px] font-medium text-text-body";

interface InviteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactInvited?: (contactId: Id<"trusted_contacts">) => void;
  initialContactType?: ContactType;
}

export function InviteContactDialog({
  open,
  onOpenChange,
  onContactInvited,
  initialContactType = "trust",
}: InviteContactDialogProps) {
  const t = useTranslations("trustedContacts");
  const inviteContact = useAuditedMutation(api.trusted_contacts.inviteContact);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<Role>("family");
  const [contactType, setContactType] =
    useState<ContactType>(initialContactType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset the form each time the dialog opens, adjusting during render instead
  // of syncing in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setContactType(initialContactType);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!email.trim() && !phone) {
      setError(t("invite.errorMissingContact"));
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError(t("invite.errorInvalidEmail"));
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError(t("invite.errorInvalidPhone"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await inviteContact({
        name: name.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        phoneNumber: phone || undefined,
        role,
        contactType,
      });
      setName("");
      setEmail("");
      setPhone(undefined);
      setRole("family");
      setContactType(initialContactType);
      onOpenChange(false);
      onContactInvited?.(
        (result as { contactId: Id<"trusted_contacts"> }).contactId,
      );
    } catch (err) {
      setError(getErrorMessage(err, t("invite.errorSend")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        contactType === "recipient_only"
          ? t("invite.titleRecipient")
          : t("invite.titleTrust")
      }
      description={
        contactType === "recipient_only"
          ? t("invite.descriptionRecipient")
          : t("invite.descriptionTrust")
      }
      width="w-[560px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
        <Field label={t("invite.fullNameLabel")}>
          {(id) => (
            <Input
              id={id}
              variant="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("invite.fullNamePlaceholder")}
              required
            />
          )}
        </Field>

        <Field label={t("invite.emailLabel")}>
          {(id) => (
            <Input
              id={id}
              type="email"
              variant="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          )}
        </Field>

        <Field label={t("invite.phoneLabel")}>
          {(id) => (
            <>
              <PhoneInput id={id} value={phone} onChange={setPhone} />
              <p className="text-body-sm text-text-muted">
                {t("invite.contactHint")}
              </p>
            </>
          )}
        </Field>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="contact-role" className={LABEL}>
            {t("invite.roleLabel")}
            <HelpHint content={t("invite.roleHelp")} />
          </label>
          <Select<Role>
            id="contact-role"
            variant="field"
            value={role}
            onValueChange={setRole}
            placeholder={t("invite.rolePlaceholder")}
          >
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(`invite.roles.${r.key}`)}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-[6px]">
          <span id="contact-type-label" className={LABEL}>
            {t("invite.roleInKeeplasLabel")}
            <HelpHint content={t("invite.roleInKeeplasHelp")} />
          </span>
          <RadioGroup
            aria-labelledby="contact-type-label"
            value={contactType}
            onValueChange={(value) => setContactType(value as ContactType)}
            className="grid gap-[8px] sm:grid-cols-2"
          >
            {CONTACT_TYPES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-[12px] rounded-md border p-[14px] transition-colors",
                  contactType === option.value
                    ? "border-action-primary bg-bg-info"
                    : "border-border-default bg-bg-surface hover:bg-bg-subtle",
                )}
              >
                <RadioGroupItem value={option.value} />
                <RowText
                  title={t(`invite.${option.key}.title`)}
                  description={t(`invite.${option.key}.description`)}
                />
              </label>
            ))}
          </RadioGroup>
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-action-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-[12px]">
          <Button
            type="button"
            variant="plain"
            size="regular"
            onClick={() => onOpenChange(false)}
          >
            {t("invite.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="regular"
            disabled={saving || !name.trim() || (!email.trim() && !phone)}
          >
            {saving
              ? t("invite.sending")
              : contactType === "recipient_only"
                ? t("invite.submitRecipient")
                : t("invite.submitTrust")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
