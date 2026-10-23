import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Select,
  SelectItem,
} from "@keeplas/ui";
import {
  Button,
  Input,
  Label,
  ErrorAlert,
  HelpHint,
  PhoneInput,
  isValidPhone,
  isValidEmail,
} from "@keeplas/ui";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("invite.titleTrust")}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("invite.descriptionTrust")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="contact-name">{t("invite.fullNameLabel")}</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("invite.fullNamePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">{t("invite.emailLabel")}</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">{t("invite.phoneLabel")}</Label>
            <PhoneInput id="contact-phone" value={phone} onChange={setPhone} />
            <p className="text-label-md text-on-surface-variant">
              {t("invite.contactHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-role" className="flex items-center gap-1.5">
              {t("invite.roleLabel")}
              <HelpHint content={t("invite.roleHelp")} />
            </Label>
            <Select<Role>
              id="contact-role"
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

          {error && <ErrorAlert message={error} />}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              {t("invite.cancel")}
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !name.trim() || (!email.trim() && !phone)}
              className="flex-1 cursor-pointer"
            >
              {saving ? t("invite.sending") : t("invite.submitTrust")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
