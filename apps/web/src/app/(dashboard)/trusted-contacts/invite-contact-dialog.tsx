"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
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
import { Button, Input, Label, ErrorAlert, cn } from "@keeplas/ui";
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
}

export function InviteContactDialog({
  open,
  onOpenChange,
  onContactInvited,
}: InviteContactDialogProps) {
  const inviteContact = useMutation(api.trusted_contacts.inviteContact);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("family");
  const [contactType, setContactType] = useState<ContactType>("trust");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSaving(true);
    setError("");

    try {
      const result = await inviteContact({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phone.trim() || undefined,
        role,
        contactType,
      });
      setName("");
      setEmail("");
      setPhone("");
      setRole("family");
      setContactType("trust");
      onOpenChange(false);
      onContactInvited?.(result.contactId);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send invitation"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <div className="flex-1 min-w-0">
            <DialogTitle>
              Invite Trusted Contact
            </DialogTitle>
            <DialogDescription className="mt-1">
              This person will receive a recovery fragment and can help you regain
              access to your vault.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-4">
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
            <Label htmlFor="contact-email">Email *</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone (optional)</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-role">Role</Label>
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
            <Label>Role in Keeplas</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContactType("trust")}
                className={cn(
                  "text-left p-4 rounded-xl border transition-colors cursor-pointer",
                  contactType === "trust"
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
                )}
              >
                <p className="text-headline-sm text-primary mb-1">
                  Trust contact
                </p>
                <p className="text-label-md text-on-surface-variant">
                  Holds a recovery shard. Counts toward your 5-trust-contacts cap.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setContactType("recipient_only")}
                className={cn(
                  "text-left p-4 rounded-xl border transition-colors cursor-pointer",
                  contactType === "recipient_only"
                    ? "border-secondary bg-secondary/10"
                    : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
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
              disabled={saving || !name.trim() || !email.trim()}
              className="flex-1 cursor-pointer"
            >
              {saving ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
