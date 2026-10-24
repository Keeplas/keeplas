import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Modal } from "@/components/v2/modal";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useTranslations } from "@/lib/i18n";
import { ContactForm } from "./contact-form";

/** Fix a contact's name, email, phone or role. */
export function EditContactDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: Doc<"trusted_contacts">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("trustedContacts");
  const updateContact = useAuditedMutation(api.trusted_contacts.updateContact);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("edit.title")}
      description={
        contact.invitationStatus === "pending"
          ? t("edit.reinviteNote")
          : undefined
      }
      width="w-[560px]"
    >
      <ContactForm
        initial={contact}
        submitLabel={t("edit.save")}
        savingLabel={t("edit.saving")}
        errorFallback={t("edit.errorSave")}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (values) => {
          await updateContact({ contactId: contact._id, ...values });
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}
