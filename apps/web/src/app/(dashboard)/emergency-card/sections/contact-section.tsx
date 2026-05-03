"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Icon,
  Input,
  Label,
  Select,
  SelectItem,
  Switch,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { InviteContactDialog } from "../../trusted-contacts/invite-contact-dialog";
import {
  ROLE_TO_RELATION_LABEL,
  type CardFormData,
} from "./constants";

interface ContactSectionProps {
  formData: CardFormData;
  showEmergencyContact: boolean;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
  onToggleEmergencyContact: () => void;
}

export function ContactSection({
  formData,
  showEmergencyContact,
  onUpdate,
  onToggleEmergencyContact,
}: ContactSectionProps) {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const [inviteOpen, setInviteOpen] = useState(false);

  const selectedContact = contacts?.find(
    (c) => c._id === formData.emergencyContactId
  );

  function handleSelectContact(contactId: Id<"trusted_contacts"> | null) {
    onUpdate("emergencyContactId", contactId);
    if (!contactId) return;
    const picked = contacts?.find((c) => c._id === contactId);
    if (picked && !formData.emergencyContactRelation) {
      const prefill = ROLE_TO_RELATION_LABEL[picked.role] ?? "";
      if (prefill) onUpdate("emergencyContactRelation", prefill);
    }
  }

  const isLoading = contacts === undefined;
  const isEmpty = contacts !== undefined && contacts.length === 0;

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-headline-sm text-primary">
          Emergency Contact
        </h3>
        <Switch
          checked={showEmergencyContact}
          onCheckedChange={onToggleEmergencyContact}
          aria-label="Show Emergency Contact on public card"
        />
      </div>

      {isEmpty ? (
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
        >
          <Icon path={ICON_PATHS.userPlus} className="w-5 h-5" />
          <span className="text-body-md font-medium">
            Invite a trusted contact to use as your emergency contact
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="emergencyContact">Contact</Label>
          <Select
            id="emergencyContact"
            value={formData.emergencyContactId ?? ""}
            onValueChange={(v) =>
              handleSelectContact(
                v ? (v as Id<"trusted_contacts">) : null
              )
            }
            placeholder={isLoading ? "Loading..." : "Select a trusted contact"}
            disabled={isLoading}
          >
            {contacts?.map((contact) => (
              <SelectItem key={contact._id} value={contact._id}>
                {contact.name}
                {contact.phoneNumber ? ` · ${contact.phoneNumber}` : ""}
              </SelectItem>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 text-label-md text-secondary hover:underline cursor-pointer"
          >
            <Icon path={ICON_PATHS.userPlus} className="w-4 h-4" />
            Invite a new trusted contact
          </button>
          {selectedContact && !selectedContact.phoneNumber && (
            <p className="text-label-md text-on-surface-variant">
              This contact has no phone number on file. Add one in Trusted Contacts so responders can reach them.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="emergencyContactRelation">Relationship</Label>
        <Input
          id="emergencyContactRelation"
          value={formData.emergencyContactRelation}
          onChange={(e) => onUpdate("emergencyContactRelation", e.target.value)}
          placeholder="e.g. Spouse, Parent, Sibling"
        />
      </div>

      <InviteContactDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onContactInvited={(contactId) => handleSelectContact(contactId)}
      />
    </div>
  );
}
