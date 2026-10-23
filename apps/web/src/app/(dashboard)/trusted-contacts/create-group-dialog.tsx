import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { Button, Input, Textarea } from "@keeplas/ui";
import { ContactMembersSelect } from "@/components/contact-members-select";
import { Modal } from "@/components/v2/modal";
import { Field } from "@/components/vault/form-fields";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

/**
 * Restyles the legacy Textarea as the v2 "App/Field" box (Input
 * variant="field"); shared with the edit dialog.
 */
export const TEXTAREA_FIELD =
  "rounded-sm border-border-default bg-bg-surface px-[14px] py-[12px] text-[15px] leading-[22px] text-text-primary placeholder:text-text-subtle hover:border-border-default focus:border-border-default focus:bg-bg-surface focus-visible:ring-2 focus-visible:ring-border-focus";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Doc<"trusted_contacts">[];
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  contacts,
}: CreateGroupDialogProps) {
  const t = useTranslations("trustedContacts");
  const createGroup = useAuditedMutation(api.recipient_groups.createGroup);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setMembers([]);
    setError("");
    setSaving(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        memberContactIds: members as Id<"trusted_contacts">[],
      });
      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, t("createGroup.error")));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t("createGroup.title")}
      description={t("createGroup.description")}
      width="w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
        <Field label={t("createGroup.nameLabel")}>
          {(id) => (
            <Input
              id={id}
              variant="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createGroup.namePlaceholder")}
              required
            />
          )}
        </Field>

        <Field label={t("createGroup.descriptionLabel")}>
          {(id) => (
            <Textarea
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createGroup.descriptionPlaceholder")}
              rows={2}
              className={TEXTAREA_FIELD}
            />
          )}
        </Field>

        <Field label={t("createGroup.membersLabel")}>
          {() => (
            <ContactMembersSelect
              contacts={contacts}
              selected={members}
              onChange={setMembers}
              placeholder={t("createGroup.membersPlaceholder")}
            />
          )}
        </Field>

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
            onClick={() => handleOpenChange(false)}
          >
            {t("createGroup.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="regular"
            disabled={saving || !name.trim()}
          >
            {saving ? t("createGroup.creating") : t("createGroup.submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
