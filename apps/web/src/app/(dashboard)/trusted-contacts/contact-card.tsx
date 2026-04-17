"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Badge } from "@keeplas/ui";
import { cn } from "@keeplas/ui";

const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Lawyer",
  doctor: "Doctor",
  other: "Other",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-warning-container text-on-warning-container",
  },
  accepted: {
    label: "Accepted",
    className: "bg-secondary-container text-on-secondary-container",
  },
  declined: {
    label: "Declined",
    className: "bg-error-container text-on-error-container",
  },
  revoked: {
    label: "Revoked",
    className: "bg-surface-container-highest text-on-surface-variant",
  },
};

const ACCESS_MODE_LABELS: Record<string, string> = {
  mode_a: "Post-mortem",
  mode_b1: "On-demand",
};

interface Contact {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: string;
  isFirstResponder: boolean;
  isMedicalContact: boolean;
  accessModes: string[];
  invitationStatus: string;
  invitedAt: number;
  acceptedAt?: number;
  shardConfirmed: boolean;
}

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const revokeContact = useMutation(api.trusted_contacts.revokeContact);
  const toggleFirstResponder = useMutation(
    api.trusted_contacts.toggleFirstResponder
  );
  const updateAccessModes = useMutation(
    api.trusted_contacts.updateAccessModes
  );

  const statusConfig = STATUS_CONFIG[contact.invitationStatus] ?? STATUS_CONFIG.pending;

  async function handleRevoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    try {
      await revokeContact({ contactId: contact._id as any });
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  }

  async function handleToggleFirstResponder() {
    await toggleFirstResponder({ contactId: contact._id as any });
  }

  async function handleToggleMode(mode: "mode_a" | "mode_b1") {
    const currentModes = contact.accessModes as Array<"mode_a" | "mode_b1" | "mode_b2" | "mode_b3" | "mode_b4">;
    const newModes = currentModes.includes(mode)
      ? currentModes.filter((m) => m !== mode)
      : [...currentModes, mode];
    await updateAccessModes({
      contactId: contact._id as any,
      accessModes: newModes as any,
    });
  }

  return (
    <div
      className={cn(
        "bg-surface-container-low rounded-xl p-5 transition-all",
        contact.isFirstResponder && "ring-2 ring-secondary/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
            <span className="font-headline font-bold text-on-primary-container text-sm">
              {contact.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">
              {contact.name}
            </h3>
            <p className="text-xs text-on-surface-variant">{contact.email}</p>
          </div>
        </div>
        <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant font-medium">
          {ROLE_LABELS[contact.role] ?? contact.role}
        </span>
        {contact.isFirstResponder && (
          <span className="text-xs px-2 py-1 rounded-lg bg-secondary/10 text-secondary font-medium">
            First Responder
          </span>
        )}
        {contact.isMedicalContact && (
          <span className="text-xs px-2 py-1 rounded-lg bg-secondary/10 text-secondary font-medium">
            Medical Contact
          </span>
        )}
        {contact.shardConfirmed && (
          <span className="text-xs px-2 py-1 rounded-lg bg-secondary-container text-on-secondary-container font-medium">
            Fragment assigned
          </span>
        )}
      </div>

      {/* Access Modes */}
      {contact.invitationStatus === "accepted" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {contact.accessModes.map((mode) => (
            <span
              key={mode}
              className="text-xs px-2 py-0.5 rounded bg-primary/5 text-primary font-medium"
            >
              {ACCESS_MODE_LABELS[mode] ?? mode}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {contact.invitationStatus !== "revoked" && (
        <div>
          <button
            onClick={() => setShowActions(!showActions)}
            className="text-xs text-secondary font-medium hover:underline cursor-pointer"
          >
            {showActions ? "Hide actions" : "Manage"}
          </button>

          {showActions && (
            <div className="mt-3 space-y-2 pt-3 border-t border-outline-variant/15">
              {contact.invitationStatus === "accepted" && (
                <>
                  <button
                    onClick={handleToggleFirstResponder}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    {contact.isFirstResponder
                      ? "Remove as First Responder"
                      : "Set as First Responder"}
                  </button>

                  <button
                    onClick={() => handleToggleMode("mode_a")}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    {contact.accessModes.includes("mode_a")
                      ? "Remove Post-mortem access"
                      : "Grant Post-mortem access"}
                  </button>

                  <button
                    onClick={() => handleToggleMode("mode_b1")}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    {contact.accessModes.includes("mode_b1")
                      ? "Remove On-demand access"
                      : "Grant On-demand access"}
                  </button>
                </>
              )}

              {confirmRevoke ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
                  >
                    {revoking ? "Revoking..." : "Confirm Revoke"}
                  </button>
                  <button
                    onClick={() => setConfirmRevoke(false)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-container-high text-on-surface cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRevoke}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-error/10 transition-colors cursor-pointer text-error"
                >
                  Revoke contact
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
