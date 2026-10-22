import { ConvexError } from "convex/values";
import {
  CAPTURE_HANDOFF_EXPIRED,
  parseCaptureQr,
} from "@keeplas/backend/lib/capture_qr";

export type CaptureScan =
  | { kind: "other" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "ok"; handoffId: string };

/**
 * W06-7: a "Scan with my phone" QR from the web app. Claims the handoff for
 * this account (the scanner then opens); `other` leaves the text to the
 * pairing flow. A QR shown by another site is refused before any call.
 */
export async function claimCaptureQr(
  text: string,
  deps: {
    claim: (handoffId: string) => Promise<unknown>;
    expectedOrigin: string;
  },
): Promise<CaptureScan> {
  const qr = parseCaptureQr(text);
  if (!qr) return { kind: "other" };
  if (qr.origin !== deps.expectedOrigin) return { kind: "invalid" };
  try {
    await deps.claim(qr.handoffId);
  } catch (error) {
    const expired =
      error instanceof ConvexError && error.data === CAPTURE_HANDOFF_EXPIRED;
    return { kind: expired ? "expired" : "invalid" };
  }
  return { kind: "ok", handoffId: qr.handoffId };
}
