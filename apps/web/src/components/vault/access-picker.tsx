import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, Checkbox } from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type ContactId = Id<"trusted_contacts">;

/** Contacts who joined Keeplas and can open what is shared with them. */
export function useShareableContacts() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  return (contacts ?? []).filter(
    (contact) => contact.invitationStatus === "accepted",
  );
}

/** "Who can see it": one checkbox per trusted contact. */
export function ContactChecklist({
  selected,
  onChange,
}: {
  selected: ContactId[];
  onChange: (selected: ContactId[]) => void;
}) {
  const t = useTranslations("vaultItem.access");
  const contacts = useShareableContacts();
  if (contacts.length === 0) {
    return (
      <p className="text-body-sm text-text-muted">
        {t("nobody")}{" "}
        <Link href="/trusted-contacts" className="text-text-link underline">
          {t("addContact")}
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-[4px]">
      {contacts.map((contact) => (
        <li key={contact._id}>
          <label className="flex cursor-pointer items-center gap-[12px] rounded-sm px-[8px] py-[8px] hover:bg-bg-subtle">
            <Checkbox
              checked={selected.includes(contact._id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, contact._id]
                    : selected.filter((id) => id !== contact._id),
                )
              }
            />
            <span className="text-label text-text-primary">{contact.name}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** "Share" / "Add people" on an item: pick who can open it, then save. */
export function AccessDialog({
  open,
  onOpenChange,
  ...form
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<AccessFormProps, "onClose">) {
  const t = useTranslations("vaultItem.access");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("body")}
      width="w-[480px]"
    >
      {/* Mounted while open only, so each opening starts from `initial`. */}
      <AccessForm {...form} onClose={() => onOpenChange(false)} />
    </Modal>
  );
}

interface AccessFormProps {
  initial: ContactId[];
  /** Resolves when saved; the dialog stays open if it throws. */
  onSave: (contactIds: ContactId[]) => Promise<void>;
  onClose: () => void;
}

function AccessForm({ initial, onSave, onClose }: AccessFormProps) {
  const t = useTranslations("vaultItem.access");
  const common = useTranslations("common");
  const [selected, setSelected] = useState<ContactId[]>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ContactChecklist selected={selected} onChange={setSelected} />
      <div className="flex justify-end gap-[12px]">
        <Button variant="plain" size="regular" onClick={onClose}>
          {common("cancel")}
        </Button>
        <Button
          variant="primary"
          size="regular"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? t("saving") : common("save")}
        </Button>
      </div>
    </>
  );
}
