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
 * Pluggable ML-DSA-65 engine. Everything crosses this boundary in the raw
 * FIPS 204 byte formats used by @noble/post-quantum: 1952-byte public key,
 * 4032-byte *expanded* secret key, 3309-byte signature. The algorithm and
 * parameters are fixed — an engine only swaps *where* the ML-DSA-65 math
 * runs, never what it computes. Async so native engines can run off the JS
 * thread.
 */
export interface MlDsaImplementation {
  sign(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array>;
  verify(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): Promise<boolean>;
}

/**
 * Default engine: @noble/post-quantum (pure JS). Used on the web and in
 * tests, and kept exported as the reference implementation so runtime
 * self-tests can cross-check an injected engine against it byte for byte.
 */
export const nobleMlDsaImplementation: MlDsaImplementation = {
  async sign(message, secretKey) {
    return new Uint8Array(ml_dsa65.sign(message, secretKey));
  },
  async verify(signature, message, publicKey) {
    return ml_dsa65.verify(signature, message, publicKey);
  },
};

let mlDsaImplementation: MlDsaImplementation = nobleMlDsaImplementation;

/**
 * Replace the ML-DSA-65 engine used by `signBytesAsync` / `verifyBytesAsync`.
 * The default (noble) is pure synchronous JS, which freezes the Hermes
 * (React Native) JS thread: the mobile app registers a native OpenSSL engine
 * at startup. Any engine must interoperate byte for byte with the noble
 * default (see the cross-checks in the mobile self-test). The sync
 * `signBytes` / `verifyBytes` below always use noble and are kept for
 * existing callers; prefer the async variants in new code.
 */
export function setMlDsaImplementation(impl: MlDsaImplementation) {
  mlDsaImplementation = impl;
}

/** Current engine; exposed for runtime cross-checks against the default. */
export function getMlDsaImplementation(): MlDsaImplementation {
  return mlDsaImplementation;
}

/** Decode and length-check a base64 ML-DSA-65 secret key. */
function decodeSecretKey(secretKeyB64: string): Uint8Array {
  const secretKey = base64ToUint8(secretKeyB64);
  if (secretKey.length !== ML_DSA_SECRET_KEY_BYTES) {
    throw new Error(
      `Secret key must be exactly ${ML_DSA_SECRET_KEY_BYTES} bytes`,
    );
  }
  return secretKey;
}

/**
 * Decode and length-check verify inputs. Returns null on any malformed input
 * so both verify variants can stay boolean gates that never throw.
 */
function decodeVerifyInputs(
  publicKeyB64: string,
  signatureB64: string,
): { publicKey: Uint8Array; signature: Uint8Array } | null {
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = base64ToUint8(publicKeyB64);
    signature = base64ToUint8(signatureB64);
  } catch {
    return null;
  }
  if (
    publicKey.length !== ML_DSA_PUBLIC_KEY_BYTES ||
    signature.length !== ML_DSA_SIGNATURE_BYTES
  ) {
    return null;
  }
  return { publicKey, signature };
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
 * base64-serialized signature. Always uses the noble engine (sync API kept
 * for existing callers); prefer `signBytesAsync` in new code.
 */
export function signBytes(secretKeyB64: string, message: Uint8Array): string {
  const secretKey = decodeSecretKey(secretKeyB64);
  try {
    const signature = ml_dsa65.sign(message, secretKey);
    return uint8ToBase64(new Uint8Array(signature));
  } finally {
    secretKey.fill(0);
  }
}

/**
 * Async `signBytes` that runs on the injected ML-DSA engine (native on
 * mobile, noble elsewhere). Same inputs, outputs and error behavior.
 */
export async function signBytesAsync(
  secretKeyB64: string,
  message: Uint8Array,
): Promise<string> {
  const secretKey = decodeSecretKey(secretKeyB64);
  try {
    return uint8ToBase64(await mlDsaImplementation.sign(message, secretKey));
  } finally {
    secretKey.fill(0);
  }
}

/**
 * Verify a base64 ML-DSA-65 signature over `message` against a base64 public
 * key. Returns false (never throws) on any malformed input or signature
 * mismatch, so callers can treat it as a plain boolean gate. Always uses the
 * noble engine (sync API kept for existing callers); prefer
 * `verifyBytesAsync` in new code.
 */
export function verifyBytes(
  publicKeyB64: string,
  message: Uint8Array,
  signatureB64: string,
): boolean {
  const inputs = decodeVerifyInputs(publicKeyB64, signatureB64);
  if (!inputs) return false;
  try {
    return ml_dsa65.verify(inputs.signature, message, inputs.publicKey);
  } catch {
    return false;
  }
}

/**
 * Async `verifyBytes` that runs on the injected ML-DSA engine (native on
 * mobile, noble elsewhere). Same inputs, outputs and never-throws contract.
 */
export async function verifyBytesAsync(
  publicKeyB64: string,
  message: Uint8Array,
  signatureB64: string,
): Promise<boolean> {
  const inputs = decodeVerifyInputs(publicKeyB64, signatureB64);
  if (!inputs) return false;
  try {
    return await mlDsaImplementation.verify(
      inputs.signature,
      message,
      inputs.publicKey,
    );
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
