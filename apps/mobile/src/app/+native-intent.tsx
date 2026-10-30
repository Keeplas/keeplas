import { parseCaptureQr } from "@keeplas/backend/lib/capture_qr";
import { parsePairingQr } from "@keeplas/crypto/pairing";

import { setPendingLink } from "@/features/link/pending-link";

const INVITE = /^invite\/[\w-]+$/;

/** "invite/abc" for keeplas://invite/abc, keeplas:///invite/abc or https://<host>/invite/abc. */
function routeOf(url: string): string {
  const [withoutQuery] = url.split(/[?#]/);
  const web = /^https?:\/\/[^/]*/i;
  const app = /^[a-z][a-z\d+.-]*:\/\//i;
  return withoutQuery
    .replace(web.test(withoutQuery) ? web : app, "")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Rewrite incoming URLs before Expo Router resolves them. Only the links
 * Keeplas hands out open a screen:
 * - the pairing and capture (W06-7) universal links keep their data in the
 *   URL fragment, which routing drops: stash the whole URL and open the
 *   scanner, which processes it like a scanned QR. A pairing link only opens
 *   the M03-5 approval screen: it never logs a browser in by itself;
 * - an invitation opens invite/[token], with no other parameter.
 * Any other URL opens the start screen: a link must never land on an inner
 * screen with parameters it chose (a spoofed security screen, a code resent
 * to the sender's number).
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
  const route = routeOf(path);
  if (INVITE.test(route)) return `/${route}`;
  // `keeplas://self-test?autorun=1` runs the crypto self-test (simulator).
  if (__DEV__ && route === "self-test") return path;
  return "/";
}
