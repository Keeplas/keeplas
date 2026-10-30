/**
 * Stateless, HMAC-signed token for the one-click Life Check email confirmation.
 *
 * The "I'm well" button in the check-in email opens the web confirm page, where
 * an explicit click calls an UNAUTHENTICATED action so the user can confirm
 * from any device without logging in. The token encodes
 * `{ cycleId, userId, exp }`.
 *
 * Key: derived from `KEEPLAS_CTX_SECRET` (no new secret to provision) but never
 * the raw secret itself, which signs the audit-context seal over a message of
 * the same `a|b|<number>` shape. With one key for both, a token's signature
 * was also a valid `_audit` envelope. The derived key is HKDF-Expand
 * (RFC 5869, one block) with the secret as PRK: HMAC(secret, info || 0x01).
 * `info` holds no "|", so no audit seal (always `ip|country|ts…`) can ever be
 * the HMAC that yields it.
 *
 * Format: `v2.base64url(body).base64url(sig)`. Links issued before v2
 * (`base64url(body).base64url(sig)`, raw-secret HMAC) are still accepted
 * until they expire.
 *
 * Zero-knowledge: the token only answers one check-in; it never carries or
 * unlocks any vault data. `life_check.confirmFromEmail` honours it only while
 * that cycle is still `running`, so once the check-in is answered, closed or
 * escalated to Stage 2 the link is spent; `exp` bounds it further.
 */
import { getAuditSecret } from "./audit_secret";

const enc = new TextEncoder();
const VERSION = "v2";
const KEY_INFO = "keeplas/life-check-token/v2";

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

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource),
  );
}

/** The token key: HKDF-Expand(PRK = secret, info = KEY_INFO), one block. */
async function tokenKey(): Promise<Uint8Array> {
  const info = enc.encode(KEY_INFO);
  const block = new Uint8Array(info.length + 1);
  block.set(info);
  block[info.length] = 0x01;
  return await hmac(enc.encode(getAuditSecret()), block);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Produce a `v2.base64url(body).base64url(sig)` token. */
export async function signLifeCheckToken(
  payload: LifeCheckTokenPayload,
): Promise<string> {
  const body = enc.encode(
    `${payload.cycleId}|${payload.userId}|${payload.exp}`,
  );
  const sig = await hmac(await tokenKey(), body);
  return `${VERSION}.${bytesToBase64Url(body)}.${bytesToBase64Url(sig)}`;
}

/** Verify signature + expiry. Returns the payload, or null when invalid. */
export async function verifyLifeCheckToken(
  token: string,
): Promise<LifeCheckTokenPayload | null> {
  const parts = token.split(".");
  let key: Uint8Array;
  let encoded: string[];
  if (parts.length === 3 && parts[0] === VERSION) {
    key = await tokenKey();
    encoded = parts.slice(1);
  } else if (parts.length === 2) {
    // Pre-v2 link, signed with the raw secret. Every one expires within the
    // 10-day link TTL (dispatch.ts) after v2 shipped: drop this branch then.
    key = enc.encode(getAuditSecret());
    encoded = parts;
  } else {
    return null;
  }

  let body: Uint8Array;
  let provided: Uint8Array;
  try {
    body = base64UrlToBytes(encoded[0]);
    provided = base64UrlToBytes(encoded[1]);
  } catch {
    return null;
  }

  const expected = await hmac(key, body);
  if (!timingSafeEqual(expected, provided)) return null;

  const segs = new TextDecoder().decode(body).split("|");
  if (segs.length !== 3) return null;
  const exp = Number(segs[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  return { cycleId: segs[0], userId: segs[1], exp };
}
