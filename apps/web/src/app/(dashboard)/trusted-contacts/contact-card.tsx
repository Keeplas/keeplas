"use client";

import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { cn } from "@keeplas/ui";
import {
  computeVerificationBadge,
  getInitials,
  ROLE_BADGE_ICONS,
  ROLE_LABELS,
  STATUS_CONFIG,
} from "./contact-display";

interface ContactCardProps {
  contact: Doc<"trusted_contacts">;
  onSelect: (contact: Doc<"trusted_contacts">) => void;
}

export function ContactCard({ contact, onSelect }: ContactCardProps) {
  const statusConfig =
    STATUS_CONFIG[contact.invitationStatus] ?? STATUS_CONFIG.pending;
  const isRecipientOnly = (contact.contactType ?? "trust") === "recipient_only";
  const verificationBadge = computeVerificationBadge(contact);
  const roleIcon = ROLE_BADGE_ICONS[contact.role] ?? ROLE_BADGE_ICONS.other;
  const roleLabel = ROLE_LABELS[contact.role] ?? "Contact";

  return (
    <button
      type="button"
      onClick={() => onSelect(contact)}
      className="w-full text-left bg-surface-container-low p-6 rounded-2xl group cursor-pointer hover:bg-surface-container transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div
          className={cn(
            "w-12 h-12 rounded-full border-2 p-0.5",
            statusConfig.avatarBorder,
          )}
        >
          <div className="w-full h-full rounded-full bg-primary-container flex items-center justify-center">
            <span className="text-label-md text-on-primary-container">
              {getInitials(contact.name)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-3 py-1 text-label-md rounded-full",
              isRecipientOnly
                ? "bg-surface-container-high text-on-surface-variant"
                : "bg-primary/10 text-primary",
            )}
          >
            {isRecipientOnly ? "Recipient" : "Trust"}
          </span>
          <span
            className={cn(
              "px-3 py-1 text-label-md rounded-full",
              statusConfig.className,
            )}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Name + primary identifier (email, falling back to phone) */}
      <h3 className="text-headline-sm text-primary">{contact.name}</h3>
      <p className="text-body-md text-on-surface-variant mb-5 truncate">
        {contact.email ?? contact.phoneNumber}
      </p>

      {/* Role + verification badges (details live in the contact sheet) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg">
          <svg
            className="w-3.5 h-3.5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={roleIcon} />
          </svg>
          <span className="text-label-md text-primary">{roleLabel}</span>
        </span>
        {contact.shardConfirmed && (
          <span className="text-label-md px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container">
            Fragment Assigned
          </span>
        )}
        {verificationBadge && (
          <span
            className={cn(
              "text-label-md px-3 py-1.5 rounded-lg",
              verificationBadge.className,
            )}
          >
            {verificationBadge.label}
          </span>
        )}
      </div>
    </button>
  );
}
