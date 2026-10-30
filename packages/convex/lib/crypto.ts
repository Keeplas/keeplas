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

const VERIFIER_DIGEST_PREFIX = "sha256:";

/**
 * What the server stores for a 24-word verifier (`recoveryPhraseHash`,
 * `totpResetVerifierHash`): its SHA-256, never the verifier itself. The
 * verifier is a bearer credential (recovery sign-in, step-up escape hatches,
 * password reset), so a stored copy must not be submittable. It is already
 * high-entropy Argon2id/PBKDF2 output, so a plain hash is enough.
 */
export async function verifierDigest(verifier: string): Promise<string> {
  return VERIFIER_DIGEST_PREFIX + (await sha256Hex(verifier));
}

/** Whether a stored verifier is still a pre-digest (legacy) value. */
export function isLegacyVerifier(stored: string): boolean {
  return !stored.startsWith(VERIFIER_DIGEST_PREFIX);
}

/**
 * Constant-time check of a submitted verifier against the stored one. Rows
 * written before digests hold the verifier itself and keep matching until
 * `migrations:digestRecoveryVerifiers` rewrites them.
 */
export async function verifierMatches(
  stored: string,
  submitted: string,
): Promise<boolean> {
  return constantTimeStringEquals(
    stored,
    isLegacyVerifier(stored) ? submitted : await verifierDigest(submitted),
  );
}

/** Decode standard base64 into bytes. Throws on malformed input. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
