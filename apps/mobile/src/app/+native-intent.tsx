import { parseCaptureQr } from "@keeplas/backend/lib/capture_qr";
import { parsePairingQr } from "@keeplas/crypto/pairing";

import { setPendingLink } from "@/features/link/pending-link";

/**
 * Rewrite incoming URLs before Expo Router resolves them. The pairing and
 * capture (W06-7) universal links keep their data in the URL fragment,
 * which routing drops:
 * stash the whole URL and open the scanner, which checks it like a scanned
 * QR. A pairing link only opens the M03-5 approval screen: it never logs a
 * browser in by itself. `keeplas://invite/<token>` resolves to
 * invite/[token] as is.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  if (parsePairingQr(path) || parseCaptureQr(path)) {
    setPendingLink(path);
    return "/scan";
  }
  return path;
}
