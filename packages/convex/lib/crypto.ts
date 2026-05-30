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
