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
import { TEXTAREA_FIELD } from "./create-group-dialog";

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Doc<"recipient_groups">;
  contacts: Doc<"trusted_contacts">[];
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  contacts,
}: EditGroupDialogProps) {
  const t = useTranslations("trustedContacts");
  const updateGroup = useAuditedMutation(api.recipient_groups.updateGroup);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [members, setMembers] = useState<string[]>(
    group.memberContactIds as string[],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset the form each time the dialog opens, adjusting during render instead
  // of syncing in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(group.name);
      setDescription(group.description ?? "");
      setMembers(group.memberContactIds as string[]);
      setError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      await updateGroup({
        groupId: group._id,
        // The default group's name is fixed server-side; omit it from the
        // payload so a stale local value can't trigger the rename rejection.
        ...(group.isDefault ? {} : { name: name.trim() }),
        description: description.trim(),
        memberContactIds: members as Id<"trusted_contacts">[],
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, t("editGroup.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("editGroup.title")}
      description={t("editGroup.description")}
      width="w-[520px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
        <Field label={t("editGroup.nameLabel")}>
          {(id) => (
            <>
              <Input
                id={id}
                variant="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                readOnly={group.isDefault}
                disabled={group.isDefault}
              />
              {group.isDefault && (
                <p className="text-body-sm text-text-muted">
                  {t("editGroup.defaultNameFixed")}
                </p>
              )}
            </>
          )}
        </Field>

        <Field label={t("editGroup.descriptionLabel")}>
          {(id) => (
            <Textarea
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={TEXTAREA_FIELD}
            />
          )}
        </Field>

        <Field label={t("editGroup.membersLabel")}>
          {() => (
            <ContactMembersSelect
              contacts={contacts}
              selected={members}
              onChange={setMembers}
              placeholder={t("editGroup.membersPlaceholder")}
              emptyPlaceholder={t("editGroup.membersEmptyPlaceholder")}
              emptyMessage={t("editGroup.membersEmptyMessage")}
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
            onClick={() => onOpenChange(false)}
          >
            {t("editGroup.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="regular"
            disabled={saving || !name.trim()}
          >
            {saving ? t("editGroup.saving") : t("editGroup.submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
