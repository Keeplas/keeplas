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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("createGroup.title")}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("createGroup.description")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="group-name">{t("createGroup.nameLabel")}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createGroup.namePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">
              {t("createGroup.descriptionLabel")}
            </Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createGroup.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("createGroup.membersLabel")}</Label>
            <ContactMembersSelect
              contacts={contacts}
              selected={members}
              onChange={setMembers}
              placeholder={t("createGroup.membersPlaceholder")}
            />
          </div>

          {error && <ErrorAlert message={error} />}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => handleOpenChange(false)}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              {t("createGroup.cancel")}
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !name.trim()}
              className="flex-1 cursor-pointer"
            >
              {saving ? t("createGroup.creating") : t("createGroup.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
