"use client";

import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Select,
  SelectItem,
} from "@keeplas/ui";
import {
  Button,
  Input,
  Label,
  ErrorAlert,
  HelpHint,
  PhoneInput,
  isValidPhone,
  isValidEmail,
  cn,
} from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";

const ROLES = [
  { value: "family", label: "Family member" },
  { value: "friend", label: "Friend" },
  { value: "lawyer", label: "Lawyer" },
  { value: "doctor", label: "Doctor" },
  { value: "other", label: "Other" },
] as const;

type Role = (typeof ROLES)[number]["value"];
type ContactType = "trust" | "recipient_only";

interface InviteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactInvited?: (contactId: Id<"trusted_contacts">) => void;
  initialContactType?: ContactType;
}

export function InviteContactDialog({
  open,
  onOpenChange,
  onContactInvited,
  initialContactType = "trust",
}: InviteContactDialogProps) {
  const inviteContact = useAuditedMutation(api.trusted_contacts.inviteContact);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<Role>("family");
  const [contactType, setContactType] =
    useState<ContactType>(initialContactType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset the form each time the dialog opens, adjusting during render instead
  // of syncing in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setContactType(initialContactType);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!email.trim() && !phone) {
      setError("Add an email or a phone number");
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError("Please enter a valid email");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Please enter a valid phone number");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await inviteContact({
        name: name.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        phoneNumber: phone || undefined,
        role,
        contactType,
      });
      setName("");
      setEmail("");
      setPhone(undefined);
      setRole("family");
      setContactType(initialContactType);
      onOpenChange(false);
      onContactInvited?.(
        (result as { contactId: Id<"trusted_contacts"> }).contactId,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send invitation"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>
              {contactType === "recipient_only"
                ? "Add Recipient"
                : "Invite Trusted Contact"}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {contactType === "recipient_only"
                ? "This person will receive vault items only when one of your triggers fires. They don't hold a recovery shard."
                : "This person will receive a recovery fragment and can help you regain access to your vault."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="contact-name">Full Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter their full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <PhoneInput id="contact-phone" value={phone} onChange={setPhone} />
            <p className="text-label-md text-on-surface-variant">
              Add an email, a phone number, or both — at least one is required.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-role" className="flex items-center gap-1.5">
              Role
              <HelpHint content="Their relationship to you. Used by Keeplas to surface the right contact in scenarios (medical, legal, family) and on hubs." />
            </Label>
            <Select<Role>
              id="contact-role"
              value={role}
              onValueChange={setRole}
              placeholder="Select a role"
            >
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Role in Keeplas
              <HelpHint content="Trust contact = holds a recovery shard, counts toward your 5-trust cap, can help recover your account. Recipient only = receives items at trigger but no recovery role and no cap." />
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContactType("trust")}
                className={cn(
                  "text-left p-4 rounded-xl border transition-colors cursor-pointer",
                  contactType === "trust"
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant bg-surface-container-low hover:bg-surface-container",
                )}
              >
                <p className="text-headline-sm text-primary mb-1">
                  Trust contact
                </p>
                <p className="text-label-md text-on-surface-variant">
                  Holds a recovery shard. Counts toward your 5-trust-contacts
                  cap.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setContactType("recipient_only")}
                className={cn(
                  "text-left p-4 rounded-xl border transition-colors cursor-pointer",
                  contactType === "recipient_only"
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant bg-surface-container-low hover:bg-surface-container",
                )}
              >
                <p className="text-headline-sm text-primary mb-1">
                  Recipient only
                </p>
                <p className="text-label-md text-on-surface-variant">
                  Receives items at trigger. No shard, no cap, no recovery role.
                </p>
              </button>
            </div>
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
              disabled={saving || !name.trim() || (!email.trim() && !phone)}
              className="flex-1 cursor-pointer"
            >
              {saving
                ? "Sending..."
                : contactType === "recipient_only"
                  ? "Add Recipient"
                  : "Send Invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
