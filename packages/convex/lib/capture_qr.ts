/**
 * W06-7 "Scan with my phone" QR: `<web origin>/capture#h=<handoff id>`.
 * Shared by apps/web (shows it) and apps/mobile (scans it). It carries no
 * secret: only the owner's own phone can claim the handoff.
 */

const QR_PATH = "/capture";

/** How long a QR can be claimed. */
export const CAPTURE_QR_TTL_MS = 2 * 60 * 1000;

/** capture_handoffs.claim errors (ConvexError data). */
export const CAPTURE_HANDOFF_INVALID = "CAPTURE_HANDOFF_INVALID";
export const CAPTURE_HANDOFF_EXPIRED = "CAPTURE_HANDOFF_EXPIRED";

export function buildCaptureQr(origin: string, handoffId: string): string {
  return `${origin}${QR_PATH}#${new URLSearchParams({ h: handoffId })}`;
}

/** The handoff id and the origin it was shown on, or null for another QR. */
export function parseCaptureQr(
  text: string,
): { handoffId: string; origin: string } | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.pathname !== QR_PATH) return null;
  const handoffId = new URLSearchParams(url.hash.slice(1)).get("h");
  return handoffId ? { handoffId, origin: url.origin } : null;
}
