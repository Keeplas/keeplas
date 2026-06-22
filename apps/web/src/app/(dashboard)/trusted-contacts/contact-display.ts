import type { Doc } from "@keeplas/backend/_generated/dataModel";

// Display helpers shared by ContactCard (list) and ContactDetailSheet (detail).
// Keep presentation logic here so both surfaces stay in lockstep.

export const ROLE_BADGE_ICONS: Record<string, string> = {
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

export const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Legal",
  doctor: "Medical",
  other: "Other",
};

export const STATUS_CONFIG: Record<
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
): { label: string; className: string; lastVerifiedAt?: number } | null {
  if (contact.invitationStatus !== "accepted") return null;
  if ((contact.contactType ?? "trust") === "recipient_only") return null;
  // No fragment distributed yet → nothing to verify, so no badge. Verification
  // is the contact unwrapping their real shard, which can't exist pre-distribution.
  if (!contact.shardConfirmed) return null;

  if (contact.lastVerifiedAt === undefined) {
    return {
      label: "Hash not yet verified",
      className: "bg-surface-container-high text-on-surface-variant",
    };
  }
  const isStale =
    Date.now() - contact.lastVerifiedAt > STALE_VERIFICATION_THRESHOLD_MS;
  return {
    label: isStale ? "Verification stale" : "Hash verified",
    className: isStale
      ? "bg-tertiary-container text-on-tertiary-container"
      : "bg-secondary-container text-on-secondary-container",
    lastVerifiedAt: contact.lastVerifiedAt,
  };
}
