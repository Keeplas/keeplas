/**
 * HMAC secret used to sign and verify the per-request audit context
 * (IP + country) issued by the Next.js middleware. The middleware signs the
 * payload server-side; Convex mutations re-verify the signature before
 * persisting the values into the audit log. The client only ferries the
 * sealed payload, so it cannot spoof its own IP or country.
 */
export function getAuditSecret(): string {
  const secret = process.env.KEEPLAS_CTX_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "KEEPLAS_CTX_SECRET is not configured (need >= 16 chars)."
    );
  }
  return secret;
}
