import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { base64ToUint8, uint8ToBase64, uint8ToHex } from "../encoding";

// ML-DSA-65 (FIPS 204) fixed byte lengths. Confirmed at runtime against
// @noble/post-quantum@0.6.1. Mirrors the ML_KEM_PARAMS shape in kem/mlkem.ts.
const ML_DSA_PUBLIC_KEY_BYTES = 1952;
const ML_DSA_SECRET_KEY_BYTES = 4032;
const ML_DSA_SIGNATURE_BYTES = 3309;

export const ML_DSA_PARAMS = {
  algorithm: "ML-DSA-65",
  fips: "FIPS 204",
  publicKeyBytes: ML_DSA_PUBLIC_KEY_BYTES,
  secretKeyBytes: ML_DSA_SECRET_KEY_BYTES,
  signatureBytes: ML_DSA_SIGNATURE_BYTES,
} as const;

export interface IdentityKeyPair {
  /** Base64-serialized ML-DSA-65 public key (published to the server). */
  publicKey: string;
  /**
   * Base64-serialized ML-DSA-65 secret key. MUST be wrapped under the master
   * key before it touches the server — the raw value never leaves the client.
   */
  secretKey: string;
}

/**
 * Generate a fresh ML-DSA-65 (FIPS 204) identity keypair. The identity key is
 * the long-lived signing key that binds a user's ML-KEM-768 public key to their
 * identity, so contacts can verify the encryption key was not substituted by a
 * malicious server (TOFU pinning + signature verification land in step 2).
 */
export function generateIdentityKeyPair(): IdentityKeyPair {
  const { publicKey, secretKey } = ml_dsa65.keygen();
  const pk = new Uint8Array(publicKey);
  const sk = new Uint8Array(secretKey);
  try {
    return {
      publicKey: uint8ToBase64(pk),
      secretKey: uint8ToBase64(sk),
    };
  } finally {
    // The base64 strings now hold the material; drop the raw bytes.
    sk.fill(0);
  }
}

/**
 * Sign `message` with a base64-serialized ML-DSA-65 secret key. Returns the
 * base64-serialized signature.
 */
export function signBytes(secretKeyB64: string, message: Uint8Array): string {
  const secretKey = base64ToUint8(secretKeyB64);
  if (secretKey.length !== ML_DSA_SECRET_KEY_BYTES) {
    throw new Error(
      `Secret key must be exactly ${ML_DSA_SECRET_KEY_BYTES} bytes`,
    );
  }
  try {
    const signature = ml_dsa65.sign(message, secretKey);
    return uint8ToBase64(new Uint8Array(signature));
  } finally {
    secretKey.fill(0);
  }
}

/**
 * Verify a base64 ML-DSA-65 signature over `message` against a base64 public
 * key. Returns false (never throws) on any malformed input or signature
 * mismatch, so callers can treat it as a plain boolean gate.
 */
export function verifyBytes(
  publicKeyB64: string,
  message: Uint8Array,
  signatureB64: string,
): boolean {
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = base64ToUint8(publicKeyB64);
    signature = base64ToUint8(signatureB64);
  } catch {
    return false;
  }
  if (
    publicKey.length !== ML_DSA_PUBLIC_KEY_BYTES ||
    signature.length !== ML_DSA_SIGNATURE_BYTES
  ) {
    return false;
  }
  try {
    return ml_dsa65.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Stable fingerprint of an ML-DSA-65 public key: lowercase hex of the SHA-256
 * of the raw public-key bytes. Used as the TOFU pin and for human comparison
 * (step 2). Deterministic for a given public key.
 */
export async function identityKeyFingerprint(
  publicKeyB64: string,
): Promise<string> {
  const publicKey = base64ToUint8(publicKeyB64);
  if (publicKey.length !== ML_DSA_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Public key must be exactly ${ML_DSA_PUBLIC_KEY_BYTES} bytes`,
    );
  }
  const digest = await crypto.subtle.digest("SHA-256", publicKey);
  return uint8ToHex(new Uint8Array(digest));
}
