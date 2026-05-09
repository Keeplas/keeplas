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
      "Convex env `KEEPLAS_CTX_SECRET` is missing or too short (need >= 16 chars). " +
        "Run `pnpm sync:convex-env` from the repo root to push it from your local `.env.local`."
    );
  }
  return secret;
}
