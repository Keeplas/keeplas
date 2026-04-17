"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn } from "@keeplas/ui";

const ROLE_BADGE_ICONS: Record<string, string> = {
  family:
    "M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z",
  friend:
    "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  lawyer:
    "M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Z",
  doctor:
    "M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75",
  other:
    "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
};

const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Legal",
  doctor: "Medical",
  other: "Other",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; avatarBorder: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-surface-variant text-on-surface-variant",
    avatarBorder: "border-outline-variant",
  },
  accepted: {
    label: "Verified",
    className: "bg-secondary-container text-on-secondary-container",
    avatarBorder: "border-secondary",
  },
  declined: {
    label: "Declined",
    className: "bg-error-container text-on-error-container",
    avatarBorder: "border-error",
  },
  revoked: {
    label: "Revoked",
    className: "bg-surface-container-highest text-on-surface-variant",
    avatarBorder: "border-outline-variant",
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
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

  const roleBadges: Array<{ icon: string; label: string }> = [];
  if (contact.isFirstResponder) {
    roleBadges.push({
      icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
      label: "First Responder",
    });
  }
  if (contact.isMedicalContact) {
    roleBadges.push({
      icon: ROLE_BADGE_ICONS.doctor,
      label: "Medical",
    });
  }
  const roleIcon = ROLE_BADGE_ICONS[contact.role] ?? ROLE_BADGE_ICONS.other;
  const roleLabel = ROLE_LABELS[contact.role] ?? "Contact";
  if (roleBadges.length === 0) {
    roleBadges.push({ icon: roleIcon, label: roleLabel });
  }

  return (
    <div
      className={cn(
        "bg-surface-container-low p-8 rounded-2xl group hover:bg-surface-container transition-all",
        contact.isFirstResponder && "ring-1 ring-secondary/40"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className={cn("w-14 h-14 rounded-full border-2 p-0.5", statusConfig.avatarBorder)}>
          <div className="w-full h-full rounded-full bg-primary-container flex items-center justify-center">
            <span className="font-headline font-bold text-on-primary-container text-sm">
              {initials}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full",
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Name + Email */}
      <h3 className="font-headline font-bold text-xl text-primary">
        {contact.name}
      </h3>
      <p className="text-sm text-on-surface-variant mb-6 truncate">
        {contact.email}
      </p>

      {/* Role Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {roleBadges.map((badge) => (
          <span
            key={badge.label}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg"
          >
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={badge.icon} />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-tight text-primary">
              {badge.label}
            </span>
          </span>
        ))}
        {contact.shardConfirmed && (
          <span className="text-[10px] px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-bold uppercase tracking-tight">
            Fragment Assigned
          </span>
        )}
      </div>

      {/* Access Modes */}
      {contact.invitationStatus === "accepted" && contact.accessModes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {contact.accessModes.map((mode) => (
            <span
              key={mode}
              className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium"
            >
              {ACCESS_MODE_LABELS[mode] ?? mode}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-5 border-t border-outline-variant/15">
        {contact.invitationStatus === "accepted" ? (
          <button
            onClick={() => setShowActions(!showActions)}
            className="text-xs font-bold text-secondary hover:underline cursor-pointer"
          >
            {showActions ? "Hide access" : "Manage Access"}
          </button>
        ) : (
          <span className="text-xs font-bold text-primary/40">
            Awaiting Verification
          </span>
        )}
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-on-surface-variant hover:text-error transition-colors cursor-pointer"
          aria-label="More"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {/* Actions panel */}
      {showActions && (
        <div className="mt-4 space-y-2 pt-4 border-t border-outline-variant/15">
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
  );
}
