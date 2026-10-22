import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, Checkbox } from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

type ContactId = Id<"trusted_contacts">;

export interface Grantee {
  contactId: ContactId;
  contactName: string;
}

/** Contacts who joined Keeplas and can open what is shared with them. */
export function useShareableContacts() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  return (contacts ?? []).filter(
    (contact) => contact.invitationStatus === "accepted",
  );
}

/**
 * "Who can see it": one checkbox per trusted contact, plus the folder's
 * grantees, checked and locked (their access comes from the folder).
 */
export function ContactChecklist({
  selected,
  onChange,
  inherited = [],
  folderName,
}: {
  selected: ContactId[];
  onChange: (selected: ContactId[]) => void;
  inherited?: Grantee[];
  folderName?: string;
}) {
  const t = useTranslations("vaultItem.access");
  const contacts = useShareableContacts().filter(
    (contact) =>
      !inherited.some((grantee) => grantee.contactId === contact._id),
  );
  if (contacts.length === 0 && inherited.length === 0) {
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
      {inherited.map((grantee) => (
        <li key={grantee.contactId}>
          <label className="flex items-center gap-[12px] rounded-sm px-[8px] py-[8px] opacity-70">
            <Checkbox checked disabled />
            <span className="flex min-w-0 flex-col">
              <span className="text-label text-text-primary">
                {grantee.contactName}
              </span>
              <span className="text-body-sm text-text-muted">
                {t("throughFolder", { name: folderName ?? "" })}
              </span>
            </span>
          </label>
        </li>
      ))}
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
  inherited: Grantee[];
  folderName?: string;
  /** Resolves when saved; the dialog stays open if it throws. */
  onSave: (contactIds: ContactId[]) => Promise<void>;
  onClose: () => void;
}

function AccessForm({
  initial,
  inherited,
  folderName,
  onSave,
  onClose,
}: AccessFormProps) {
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
      <ContactChecklist
        selected={selected}
        onChange={setSelected}
        inherited={inherited}
        folderName={folderName}
      />
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
