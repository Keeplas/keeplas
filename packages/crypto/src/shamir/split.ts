import { gfEvalPoly } from "./gf256";

/**
 * Split a secret into n shares with threshold t (t-of-n scheme).
 * Default: 3-of-5 (any 3 shares can reconstruct the secret).
 *
 * Each share is a Uint8Array where:
 *   - byte 0: the x-coordinate (evaluation point, 1-indexed)
 *   - bytes 1..secretLen: the y-values for each byte of the secret
 *
 * Uses Shamir's Secret Sharing over GF(256).
 */
export async function split(
  secret: Uint8Array,
  totalShares: number = 5,
  threshold: number = 3,
): Promise<Uint8Array[]> {
  if (totalShares < 2) throw new Error("Need at least 2 shares");
  if (threshold < 2) throw new Error("Threshold must be at least 2");
  if (threshold > totalShares)
    throw new Error("Threshold cannot exceed total shares");
  if (totalShares > 255) throw new Error("Maximum 255 shares (GF(256) limit)");
  if (secret.length === 0) throw new Error("Secret cannot be empty");

  const shares: Uint8Array[] = [];

  for (let i = 0; i < totalShares; i++) {
    // x-coordinates are 1-indexed (1..n) — 0 is reserved for the secret
    shares.push(new Uint8Array(1 + secret.length));
    shares[i][0] = i + 1;
  }

  // For each byte of the secret, create a random polynomial of degree (threshold-1)
  // with the secret byte as the constant term, then evaluate at each x-coordinate
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIdx]; // constant term = secret byte

    // Random coefficients for degrees 1..(threshold-1)
    const randomCoeffs = new Uint8Array(threshold - 1);
    crypto.getRandomValues(randomCoeffs);
    coefficients.set(randomCoeffs, 1);

    // Evaluate polynomial at each share's x-coordinate
    for (let i = 0; i < totalShares; i++) {
      const x = shares[i][0]; // x-coordinate (1-indexed)
      shares[i][1 + byteIdx] = gfEvalPoly(coefficients, x);
    }
  }

  return shares;
}
