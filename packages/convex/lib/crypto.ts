/**
 * Server-side crypto helpers for Convex functions.
 *
 * Kept local to the Convex package on purpose: Convex bundles its own
 * directory and must not depend on the browser crypto package (`@keeplas/crypto`),
 * which pulls in WebCrypto-only modules. This file holds only pure, runtime-safe
 * primitives the server legitimately needs.
 */

/**
 * Constant-time string comparison. Avoids leaking, via timing, how many
 * leading characters of a secret verifier matched. Returns false immediately
 * on length mismatch (length is not itself secret here).
 */
export function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Lowercase hex SHA-256 digest. Strings are hashed as their UTF-8 bytes.
 * Used to store one-time codes and tokens as hashes, never in clear.
 */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode standard base64 into bytes. Throws on malformed input. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
