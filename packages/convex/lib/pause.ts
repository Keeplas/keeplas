/**
 * Operational kill switches, read from the Convex deployment env so they can be
 * flipped without a redeploy (`npx convex env set LIFE_CHECK_PAUSED true`, or
 * set them in `.env.local` and run `pnpm sync:convex-env`).
 *
 * - `NOTIFICATIONS_PAUSED` — every outbound user-facing notification
 *   (Life Check check-ins/reminders, trusted-contact notices, invitations,
 *   welcome / setup-reminder emails and WhatsApp messages) is skipped.
 *   Authentication OTPs and the support contact form are NOT affected.
 * - `LIFE_CHECK_PAUSED` — the inactivity counting stops: no new Life Check
 *   cycle is started and in-flight cycles stop progressing through their
 *   escalation timeline until the flag is cleared.
 */
function flag(key: string): boolean {
  const value = process.env[key];
  return value === "true" || value === "1";
}

export function isNotificationsPaused(): boolean {
  return flag("NOTIFICATIONS_PAUSED");
}

export function isLifeCheckPaused(): boolean {
  return flag("LIFE_CHECK_PAUSED");
}
