/**
 * Galois Field GF(256) arithmetic using the irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11b).
 * Used for Shamir Secret Sharing byte-level operations.
 */

// Precomputed log and exp tables for GF(256)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

// Build lookup tables using generator 3
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x ^ (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    x &= 0xff;
  }
  // Extend exp table for easier modular access
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

export function gfAdd(a: number, b: number): number {
  return a ^ b;
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero in GF(256)");
  if (a === 0) return 0;
  return EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

export function gfInv(a: number): number {
  if (a === 0) throw new Error("Zero has no inverse in GF(256)");
  return EXP[255 - LOG[a]];
}

/**
 * Evaluate a polynomial at point x in GF(256).
 * coefficients[0] is the constant term (the secret).
 */
export function gfEvalPoly(coefficients: Uint8Array, x: number): number {
  let result = 0;
  // Horner's method (evaluate from highest degree down)
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gfAdd(gfMul(result, x), coefficients[i]);
  }
  return result;
}

/**
 * Lagrange interpolation at x=0 in GF(256) to recover the secret.
 * points: array of [x, y] pairs.
 */
export function gfInterpolate(points: Array<[number, number]>): number {
  let secret = 0;
  const k = points.length;

  for (let i = 0; i < k; i++) {
    let numerator = 1;
    let denominator = 1;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      // Evaluating at x=0, so (0 - xj) = xj in GF(256) since addition = subtraction
      numerator = gfMul(numerator, points[j][0]);
      denominator = gfMul(denominator, gfAdd(points[i][0], points[j][0]));
    }
    const lagrange = gfDiv(numerator, denominator);
    secret = gfAdd(secret, gfMul(points[i][1], lagrange));
  }

  return secret;
}
