/**
 * Vault auto-lock policy. The phone locks sooner than the web (20 min idle):
 * a phone is easier to pick up than a desk computer.
 */
export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const BACKGROUND_GRACE_MS = 30 * 1000;

/** Lock when the app comes back after more than the background grace. */
export function shouldLockOnResume(
  backgroundedAt: number | null,
  now: number,
): boolean {
  return backgroundedAt !== null && now - backgroundedAt > BACKGROUND_GRACE_MS;
}
