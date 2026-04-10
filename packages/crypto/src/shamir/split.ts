/**
 * Split a secret into n shares with threshold t (t-of-n scheme).
 * Default: 3-of-5 (any 3 shares can reconstruct the secret).
 *
 * TODO: Implement Shamir's Secret Sharing over GF(256) in Phase 2.
 */
export async function split(
  _secret: Uint8Array,
  _totalShares: number = 5,
  _threshold: number = 3
): Promise<Uint8Array[]> {
  throw new Error("Not implemented — Phase 2");
}
