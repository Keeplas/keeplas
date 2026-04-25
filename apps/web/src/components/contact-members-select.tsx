"use client";

import { useState } from "react";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { InviteContactDialog } from "@/app/(dashboard)/trusted-contacts/invite-contact-dialog";

interface ContactMembersSelectProps {
  contacts: Doc<"trusted_contacts">[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyPlaceholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function ContactMembersSelect({
  contacts,
  selected,
  onChange,
  placeholder = "Add contacts",
  emptyPlaceholder,
  searchPlaceholder = "Search contacts…",
  emptyMessage = "Invite contacts first to add them here.",
}: ContactMembersSelectProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const memberOptions: MultiSelectOption[] = contacts.map((c) => ({
    value: c._id,
    label: c.name,
    hint: c.email,
  }));

  const triggerEmpty = emptyPlaceholder ?? placeholder;

  return (
    <>
      <MultiSelect
        options={memberOptions}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        renderTrigger={(values) => {
          if (values.length === 0) {
            return <span className="text-outline-variant">{triggerEmpty}</span>;
          }
          const labels = values
            .map((v) => memberOptions.find((o) => o.value === v)?.label)
            .filter(Boolean);
          return <span className="truncate">{labels.join(", ")}</span>;
        }}
        footer={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              setInviteOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-secondary hover:bg-surface-container-high transition-colors cursor-pointer font-medium"
          >
            <Icon
              path={ICON_PATHS.userPlus}
              className="w-4 h-4"
              strokeWidth={1.75}
            />
            Add new contact
          </button>
        )}
      />

      <InviteContactDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onContactInvited={(contactId: Id<"trusted_contacts">) => {
          if (!selected.includes(contactId)) {
            onChange([...selected, contactId]);
          }
        }}
      />
    </>
  );
}
