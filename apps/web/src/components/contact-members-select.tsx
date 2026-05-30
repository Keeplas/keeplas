"use client";

import { useState } from "react";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
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
  placeholder,
  emptyPlaceholder,
  searchPlaceholder,
  emptyMessage,
}: ContactMembersSelectProps) {
  const t = useTranslations("trustedContacts");
  const [inviteOpen, setInviteOpen] = useState(false);

  const resolvedPlaceholder = placeholder ?? t("membersSelect.placeholder");
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("membersSelect.searchPlaceholder");
  const resolvedEmptyMessage = emptyMessage ?? t("membersSelect.emptyMessage");

  const memberOptions: MultiSelectOption[] = contacts.map((c) => ({
    value: c._id,
    label: c.name,
    hint: c.email,
  }));

  const triggerEmpty = emptyPlaceholder ?? resolvedPlaceholder;

  return (
    <>
      <MultiSelect
        options={memberOptions}
        selected={selected}
        onChange={onChange}
        placeholder={resolvedPlaceholder}
        searchPlaceholder={resolvedSearchPlaceholder}
        emptyMessage={resolvedEmptyMessage}
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
            {t("membersSelect.addNew")}
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
