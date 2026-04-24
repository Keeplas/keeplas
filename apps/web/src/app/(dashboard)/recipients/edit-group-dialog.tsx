"use client";

import { useEffect, useState } from "react";
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
  ErrorAlert,
} from "@keeplas/ui";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { getErrorMessage } from "@/lib/utils";

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
  const updateGroup = useMutation(api.recipient_groups.updateGroup);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [members, setMembers] = useState<string[]>(
    group.memberContactIds as string[]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(group.name);
      setDescription(group.description ?? "");
      setMembers(group.memberContactIds as string[]);
      setError("");
    }
  }, [open, group]);

  const memberOptions: MultiSelectOption[] = contacts.map((c) => ({
    value: c._id,
    label: c.name,
    hint: c.email,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      await updateGroup({
        groupId: group._id,
        name: name.trim(),
        description: description.trim(),
        memberContactIds: members as Id<"trusted_contacts">[],
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update group"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <div className="flex-1 min-w-0">
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription className="mt-1">
              Update name, description and members of this release group.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Group name</Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-group-description">Description</Label>
            <Textarea
              id="edit-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Members</Label>
            <MultiSelect
              options={memberOptions}
              selected={members}
              onChange={setMembers}
              placeholder="Add contacts"
              searchPlaceholder="Search contacts…"
              emptyMessage="No contacts available."
              renderTrigger={(selected) => {
                if (selected.length === 0) {
                  return (
                    <span className="text-outline-variant">
                      No members selected
                    </span>
                  );
                }
                const labels = selected
                  .map((v) => memberOptions.find((o) => o.value === v)?.label)
                  .filter(Boolean);
                return <span className="truncate">{labels.join(", ")}</span>;
              }}
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !name.trim()}
              className="flex-1 cursor-pointer"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
