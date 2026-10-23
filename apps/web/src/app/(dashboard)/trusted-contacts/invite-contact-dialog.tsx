import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Button,
  HelpHint,
  Input,
  isValidEmail,
  isValidPhone,
  PhoneInput,
  Select,
  SelectItem,
} from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
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

type Role = (typeof ROLES)[number]["value"];

/** Field label with a help hint (same look as `Field`'s label). */
const LABEL =
  "flex items-center gap-[6px] text-[13px] leading-[18px] font-medium text-text-body";

interface InviteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactInvited?: (contactId: Id<"trusted_contacts">) => void;
}

export function InviteContactDialog({
  open,
  onOpenChange,
  onContactInvited,
}: InviteContactDialogProps) {
  const t = useTranslations("trustedContacts");
  const inviteContact = useAuditedMutation(api.trusted_contacts.inviteContact);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<Role>("family");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      });
      setName("");
      setEmail("");
      setPhone(undefined);
      setRole("family");
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
      title={t("invite.titleTrust")}
      description={t("invite.descriptionTrust")}
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
            {saving ? t("invite.sending") : t("invite.submitTrust")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
