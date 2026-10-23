import type { Doc } from "@keeplas/backend/_generated/dataModel";

// Display helpers shared by ContactCard (list) and ContactDetailSheet (detail).
// Keep presentation logic here so both surfaces stay in lockstep.

export const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Legal",
  doctor: "Medical",
  other: "Other",
};

/** Look of a v2 StatusChip: pill tone and optional status dot. */
export interface ChipStyle {
  tone: "pending" | "neutral";
  dot?: string;
}

export const STATUS_CONFIG: Record<string, ChipStyle & { label: string }> = {
  pending: { label: "Pending", tone: "pending", dot: "bg-status-pending" },
  accepted: { label: "Verified", tone: "neutral", dot: "bg-status-active" },
  declined: { label: "Declined", tone: "neutral", dot: "bg-action-danger" },
  revoked: { label: "Revoked", tone: "neutral", dot: "bg-status-revoked" },
};

/**
 * Minimum trust contacts for a working continuity setup: the unreachability
 * quorum needs two votes. Mirrors MIN_TRUST_CONTACTS_FOR_RECOVERY in
 * packages/convex/trusted_contacts.ts (Convex constants can't be imported into
 * the web build).
 */
export const MIN_TRUST_CONTACTS_FOR_RECOVERY = 2;

export const STALE_VERIFICATION_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.round(month / 12);
  return `${year}y ago`;
}

/**
 * True when an accepted contact has not yet published their encryption key —
 * mirrors the 3-field check in `verifyContactKey` / `getItemsNeedingRewrap`.
 * Surfaces the window between accepting an invitation and finalizing crypto, so
 * the "shares are pending" toast lines up with what the owner sees on the card.
 * Non-accepted rows are excluded: their status badge ("Pending") already says it.
 */
export function isAwaitingKey(contact: Doc<"trusted_contacts">): boolean {
  if (contact.invitationStatus !== "accepted") return false;
  return !(
    contact.contactPublicKey &&
    contact.contactIdentityPublicKey &&
    contact.contactPublicKeySignature
  );
}

export function computeVerificationBadge(
  contact: Doc<"trusted_contacts">,
): (ChipStyle & { label: string; lastVerifiedAt?: number }) | null {
  if (contact.invitationStatus !== "accepted") return null;
  if (contact.lastVerifiedAt === undefined) {
    return {
      label: "Availability not yet confirmed",
      tone: "neutral",
    };
  }
  const isStale =
    Date.now() - contact.lastVerifiedAt > STALE_VERIFICATION_THRESHOLD_MS;
  return isStale
    ? {
        label: "Availability stale",
        tone: "pending",
        lastVerifiedAt: contact.lastVerifiedAt,
      }
    : {
        label: "Available",
        tone: "neutral",
        dot: "bg-status-active",
        lastVerifiedAt: contact.lastVerifiedAt,
      };
}
