import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Modal } from "@/components/v2/modal";
import { useTranslations } from "@/lib/i18n";
import { ContactForm } from "./contact-form";

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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("invite.titleTrust")}
      description={t("invite.descriptionTrust")}
      width="w-[560px]"
    >
      <ContactForm
        submitLabel={t("invite.submitTrust")}
        savingLabel={t("invite.sending")}
        errorFallback={t("invite.errorSend")}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (values) => {
          const result = await inviteContact(values);
          onOpenChange(false);
          onContactInvited?.(
            (result as { contactId: Id<"trusted_contacts"> }).contactId,
          );
        }}
      />
    </Modal>
  );
}
