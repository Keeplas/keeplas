import { gfInterpolate } from "./gf256";

/**
 * Reconstruct a secret from t or more shares.
 *
 * Each share is a Uint8Array where:
 *   - byte 0: the x-coordinate (evaluation point)
 *   - bytes 1..N: the y-values for each byte of the secret
 *
 * Uses Lagrange interpolation over GF(256).
 */
export async function reconstruct(
  shares: Uint8Array[]
): Promise<Uint8Array> {
  if (shares.length < 2) throw new Error("Need at least 2 shares to reconstruct");

  // All shares must have the same length
  const shareLen = shares[0].length;
  if (shareLen < 2) throw new Error("Invalid share: too short");
  for (const share of shares) {
    if (share.length !== shareLen) {
      throw new Error("All shares must have the same length");
    }
  }

  // Verify no duplicate x-coordinates
  const xCoords = new Set(shares.map((s) => s[0]));
  if (xCoords.size !== shares.length) {
    throw new Error("Duplicate shares detected");
  }

  const secretLen = shareLen - 1;
  const secret = new Uint8Array(secretLen);

  // For each byte position, perform Lagrange interpolation at x=0
  for (let byteIdx = 0; byteIdx < secretLen; byteIdx++) {
    const points: Array<[number, number]> = shares.map((share) => [
      share[0],              // x-coordinate
      share[1 + byteIdx],   // y-value for this byte
    ]);
    secret[byteIdx] = gfInterpolate(points);
  }

  return secret;
}
