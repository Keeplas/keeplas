export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Constant-time comparison of two strings.
 *
 * The running time depends only on the length of `a`, never on where the
 * first differing character is, so it does not leak match position through
 * timing. Use for comparing secrets / verifiers (e.g. recovery-phrase
 * verifiers, MACs) on the client. Server-side comparisons still need their
 * own constant-time check.
 *
 * Length mismatches return false but are folded into the same loop so a
 * length difference is not trivially distinguishable by an early return.
 */
export function constantTimeStringEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    // When b is shorter, charCodeAt returns NaN; coerce to 0 so the XOR
    // still contributes a non-zero diff (the length check already flagged it).
    diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
