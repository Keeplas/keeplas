/**
 * A trusted contact proves they can still act for the people who chose them
 * by stamping `lastVerifiedAt` (trusted_contacts.confirmAvailability). The
 * server nudges a stamp older than 30 days (RECONFIRM_STALE_MS); renewing it
 * after a week keeps anyone who opens Keeplas every three weeks from being
 * nudged, for at most one audit entry per owner and week.
 */
export const RECONFIRM_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Vaults whose availability stamp is missing or due for renewal. */
export function dueForConfirmation<T extends { lastVerifiedAt?: number }>(
  vaults: readonly T[],
  now: number,
): T[] {
  return vaults.filter(
    (vault) =>
      vault.lastVerifiedAt === undefined ||
      now - vault.lastVerifiedAt > RECONFIRM_AFTER_MS,
  );
}
