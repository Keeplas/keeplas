import { parsePairingQr, type PairingQr } from "@keeplas/crypto/pairing";

/** What `pairing.get` returns for a live, waiting session. */
export interface PairingSession {
  browserPublicKey: string;
  userAgent: string;
  approxLocation?: string;
  expiresAt: number;
}

export type ScanOutcome =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "mismatch"; qr: PairingQr; receivedHash: string }
  | { kind: "ok"; qr: PairingQr; session: PairingSession };

export interface ScanDeps {
  /** `pairing.get`; throws for a malformed session id. */
  getSession: (sessionId: string) => Promise<PairingSession | null>;
  /** `pairingKeyHash` from @keeplas/crypto/pairing. */
  keyHash: (publicKey: string) => Promise<string>;
  /** Web app origin the envelope may be sealed for (EXPO_PUBLIC_APP_URL). */
  expectedOrigin: string;
}

/**
 * M03-4 → M03-5 / M09-3: read a scanned QR (or universal link), load the
 * pairing session and check that the browser key Convex holds is the one the
 * QR shows. A mismatch means the key was substituted: never seal to it.
 */
export async function evaluatePairingQr(
  text: string,
  deps: ScanDeps,
): Promise<ScanOutcome> {
  const qr = parsePairingQr(text.trim());
  // A QR for another origin would seal the vault key to a look-alike site.
  if (!qr || qr.origin !== deps.expectedOrigin) return { kind: "invalid" };
  let session: PairingSession | null;
  try {
    session = await deps.getSession(qr.sessionId);
  } catch {
    return { kind: "invalid" };
  }
  if (!session) return { kind: "expired" };
  const receivedHash = await deps.keyHash(session.browserPublicKey);
  if (receivedHash !== qr.keyHash)
    return { kind: "mismatch", qr, receivedHash };
  return { kind: "ok", qr, session };
}

/** "a3f921c788e04b12…" → "A3F9 · 21C7 · 88E0 · 4B12" (M09-3 fingerprint). */
export function formatFingerprint(hash: string): string {
  return (
    hash
      .slice(0, 16)
      .toUpperCase()
      .match(/.{1,4}/g) ?? []
  ).join(" · ");
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** "Chrome on macOS" from a user agent; null parts when unknown. */
export function describeUserAgent(ua: string): {
  browser: string | null;
  os: string | null;
} {
  return {
    browser: BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null,
    os: SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null,
  };
}
