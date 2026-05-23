/**
 * Stateless, HMAC-signed token for the one-click Life Check email confirmation.
 *
 * The "I'm well" button in the check-in email links to an UNAUTHENTICATED HTTP
 * action so the user can confirm from any device without logging in. The token
 * encodes `{ cycleId, userId, exp }` and is signed with the existing
 * `KEEPLAS_CTX_SECRET` (the same secret used for the audit context HMAC — a
 * different message domain, no new secret to provision).
 *
 * Zero-knowledge: the token only authorises resetting a liveness timer; it
 * never carries or unlocks any vault data. Replay after the cycle resolves is a
 * harmless no-op, and `exp` bounds how long a leaked link stays usable.
 */
import { getAuditSecret } from "./audit_secret";

const enc = new TextEncoder();

export interface LifeCheckTokenPayload {
  cycleId: string;
  userId: string;
  exp: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getAuditSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(data) as BufferSource,
  );
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Produce a `base64url(body).base64url(sig)` token. */
export async function signLifeCheckToken(
  payload: LifeCheckTokenPayload,
): Promise<string> {
  const body = `${payload.cycleId}|${payload.userId}|${payload.exp}`;
  const sig = await hmac(body);
  return `${bytesToBase64Url(enc.encode(body))}.${bytesToBase64Url(sig)}`;
}

/** Verify signature + expiry. Returns the payload, or null when invalid. */
export async function verifyLifeCheckToken(
  token: string,
): Promise<LifeCheckTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  let body: string;
  let provided: Uint8Array;
  try {
    body = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    provided = base64UrlToBytes(parts[1]);
  } catch {
    return null;
  }

  const expected = await hmac(body);
  if (!timingSafeEqual(expected, provided)) return null;

  const segs = body.split("|");
  if (segs.length !== 3) return null;
  const exp = Number(segs[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  return { cycleId: segs[0], userId: segs[1], exp };
}
