"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
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
  Switch,
  ErrorAlert,
} from "@keeplas/ui";
import { ContactMembersSelect } from "@/components/contact-members-select";
import { getErrorMessage } from "@/lib/utils";

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
  const createGroup = useMutation(api.recipient_groups.createGroup);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setMembers([]);
    setIsDefault(false);
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
        isDefault,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create group"));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <div className="flex-1 min-w-0">
            <DialogTitle>Create Release Group</DialogTitle>
            <DialogDescription className="mt-1">
              A reusable bundle of recipients you can assign to vault items.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name *</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family, Legal, Business"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of items will this group receive?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Members</Label>
            <ContactMembersSelect
              contacts={contacts}
              selected={members}
              onChange={setMembers}
              placeholder="Add contacts to this group"
            />
          </div>

          <div className="flex items-start justify-between gap-4 bg-surface-container-low rounded-xl p-4">
            <div>
              <p className="text-headline-sm text-primary">
                Default group
              </p>
              <p className="text-body-md text-on-surface-variant mt-0.5">
                New vault items without explicit recipients will route here.
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
              className="mt-1"
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !name.trim()}
              className="flex-1 cursor-pointer"
            >
              {saving ? "Creating…" : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
