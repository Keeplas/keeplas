"use client";

import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  ErrorAlert,
} from "@keeplas/ui";
import { ContactMembersSelect } from "@/components/contact-members-select";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("editGroup.title")}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("editGroup.description")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">{t("editGroup.nameLabel")}</Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              readOnly={group.isDefault}
              disabled={group.isDefault}
            />
            {group.isDefault && (
              <p className="text-label-md text-on-surface-variant">
                {t("editGroup.defaultNameFixed")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-group-description">
              {t("editGroup.descriptionLabel")}
            </Label>
            <Textarea
              id="edit-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("editGroup.membersLabel")}</Label>
            <ContactMembersSelect
              contacts={contacts}
              selected={members}
              onChange={setMembers}
              placeholder={t("editGroup.membersPlaceholder")}
              emptyPlaceholder={t("editGroup.membersEmptyPlaceholder")}
              emptyMessage={t("editGroup.membersEmptyMessage")}
            />
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
              {t("editGroup.cancel")}
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !name.trim()}
              className="flex-1 cursor-pointer"
            >
              {saving ? t("editGroup.saving") : t("editGroup.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
