"use client";

import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { EditGroupDialog } from "./edit-group-dialog";

interface RecipientGroupCardProps {
  group: Doc<"recipient_groups">;
  contacts: Doc<"trusted_contacts">[];
}

export function RecipientGroupCard({ group, contacts }: RecipientGroupCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  const setDefaultGroup = useAuditedMutation(api.recipient_groups.setDefaultGroup);
  const deleteGroup = useAuditedMutation(api.recipient_groups.deleteGroup);

  const memberContacts = contacts.filter((c) =>
    group.memberContactIds.includes(c._id)
  );

  async function handleSetDefault() {
    if (group.isDefault) return;
    setBusy(true);
    try {
      await setDefaultGroup({ groupId: group._id });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteGroup({ groupId: group._id });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-surface-container-low p-6 rounded-2xl group hover:bg-surface-container transition-all",
        group.isDefault && "ring-1 ring-secondary/40"
      )}
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-on-secondary shrink-0"
          style={{ backgroundColor: group.color ?? "var(--color-secondary)" }}
        >
          <Icon path={ICON_PATHS.users} className="w-6 h-6" strokeWidth={1.5} />
        </div>
        {group.isDefault && (
          <span className="px-3 py-1 text-label-md rounded-full bg-secondary-container text-on-secondary-container">
            Default
          </span>
        )}
      </div>

      <h3 className="text-headline-sm text-primary">{group.name}</h3>
      {group.description && (
        <p className="text-body-md text-on-surface-variant mt-1">
          {group.description}
        </p>
      )}

      <p className="text-label-md text-on-surface-variant mt-4 mb-3">
        {memberContacts.length}{" "}
        {memberContacts.length === 1 ? "member" : "members"}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-6 min-h-[28px]">
        {memberContacts.length === 0 ? (
          <span className="text-label-md text-on-surface-variant/60 italic">
            No members yet
          </span>
        ) : (
          memberContacts.slice(0, 5).map((c) => (
            <span
              key={c._id}
              className="text-label-md px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant"
            >
              {c.name}
            </span>
          ))
        )}
        {memberContacts.length > 5 && (
          <span className="text-label-md px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant">
            +{memberContacts.length - 5}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center pt-5 border-t border-outline-variant/15">
        <button
          onClick={() => setShowEdit(true)}
          className="text-body-md font-bold text-secondary hover:underline cursor-pointer"
        >
          Manage members
        </button>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          aria-label="More"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {showActions && (
        <div className="mt-4 space-y-2 pt-4 border-t border-outline-variant/15">
          {!group.isDefault && (
            <button
              onClick={handleSetDefault}
              disabled={busy}
              className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface disabled:opacity-60"
            >
              Set as default group
            </button>
          )}
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-container-high text-on-surface cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-error/10 transition-colors cursor-pointer text-error"
            >
              Delete group
            </button>
          )}
        </div>
      )}

      <EditGroupDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        group={group}
        contacts={contacts}
      />
    </div>
  );
}
