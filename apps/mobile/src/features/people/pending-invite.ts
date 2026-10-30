/**
 * A contact invitation opened while signed out (`/invite/<token>`). Held in
 * memory through sign-in, then reopened once the vault is unlocked, so the
 * invitee doesn't have to find the link again.
 */
let pending: string | null = null;

export function setPendingInvite(token: string) {
  pending = token;
}

export function takePendingInvite(): string | null {
  const token = pending;
  pending = null;
  return token;
}
