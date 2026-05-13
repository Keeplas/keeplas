import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { base64ToUint8, uint8ToBase64 } from "../encoding";

const ML_KEM_PUBLIC_KEY_BYTES = 1184;
const ML_KEM_SECRET_KEY_BYTES = 2400;
const ML_KEM_CIPHERTEXT_BYTES = 1088;
const SHARED_SECRET_BYTES = 32;

export const ML_KEM_PARAMS = {
  algorithm: "ML-KEM-768",
  fips: "FIPS 203",
  publicKeyBytes: ML_KEM_PUBLIC_KEY_BYTES,
  secretKeyBytes: ML_KEM_SECRET_KEY_BYTES,
  ciphertextBytes: ML_KEM_CIPHERTEXT_BYTES,
  sharedSecretBytes: SHARED_SECRET_BYTES,
} as const;

export interface RecipientKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface DekEnvelope {
  v: 1;
  alg: "ml-kem-768+aes-256-gcm";
  kem: string;
  iv: string;
  ct: string;
}

export function generateRecipientKeyPair(): RecipientKeyPair {
  const { publicKey, secretKey } = ml_kem768.keygen();
  return {
    publicKey: new Uint8Array(publicKey),
    secretKey: new Uint8Array(secretKey),
  };
}

export function serializePublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== ML_KEM_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Public key must be exactly ${ML_KEM_PUBLIC_KEY_BYTES} bytes`,
    );
  }
  return uint8ToBase64(publicKey);
}

export function parsePublicKey(serialized: string): Uint8Array {
  const bytes = base64ToUint8(serialized);
  if (bytes.length !== ML_KEM_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Decoded public key must be exactly ${ML_KEM_PUBLIC_KEY_BYTES} bytes`,
    );
  }
  return bytes;
}

export function serializeSecretKey(secretKey: Uint8Array): string {
  if (secretKey.length !== ML_KEM_SECRET_KEY_BYTES) {
    throw new Error(
      `Secret key must be exactly ${ML_KEM_SECRET_KEY_BYTES} bytes`,
    );
  }
  return uint8ToBase64(secretKey);
}

export function parseSecretKey(serialized: string): Uint8Array {
  const bytes = base64ToUint8(serialized);
  if (bytes.length !== ML_KEM_SECRET_KEY_BYTES) {
    throw new Error(
      `Decoded secret key must be exactly ${ML_KEM_SECRET_KEY_BYTES} bytes`,
    );
  }
  return bytes;
}

async function importAesKeyFromSharedSecret(
  sharedSecret: Uint8Array,
): Promise<CryptoKey> {
  const buf = new Uint8Array(sharedSecret.length);
  buf.set(sharedSecret);
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Wrap a DEK (AES-GCM CryptoKey) for a recipient identified by their
 * ML-KEM-768 public key (base64-serialized).
 *
 * Returns a JSON envelope string with the KEM ciphertext, the AES-GCM IV,
 * and the AES-GCM-encrypted DEK. Designed to live inside the existing
 * `ownerWrappedDek` / `wrappedDek` / `encryptedShard` string fields.
 */
export async function wrapDek(
  dek: CryptoKey,
  recipientPublicKeyB64: string,
): Promise<string> {
  const recipientPublicKey = parsePublicKey(recipientPublicKeyB64);
  const { cipherText, sharedSecret } =
    ml_kem768.encapsulate(recipientPublicKey);
  const wrapKey = await importAesKeyFromSharedSecret(
    new Uint8Array(sharedSecret),
  );
  const rawDek = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const buf = new Uint8Array(rawDek.byteLength);
    buf.set(rawDek);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      buf,
    );
    const envelope: DekEnvelope = {
      v: 1,
      alg: "ml-kem-768+aes-256-gcm",
      kem: uint8ToBase64(new Uint8Array(cipherText)),
      iv: uint8ToBase64(iv),
      ct: uint8ToBase64(new Uint8Array(ciphertext)),
    };
    return JSON.stringify(envelope);
  } finally {
    rawDek.fill(0);
  }
}

export async function wrapBytes(
  raw: Uint8Array,
  recipientPublicKeyB64: string,
): Promise<string> {
  const recipientPublicKey = parsePublicKey(recipientPublicKeyB64);
  const { cipherText, sharedSecret } =
    ml_kem768.encapsulate(recipientPublicKey);
  const wrapKey = await importAesKeyFromSharedSecret(
    new Uint8Array(sharedSecret),
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    buf,
  );
  const envelope: DekEnvelope = {
    v: 1,
    alg: "ml-kem-768+aes-256-gcm",
    kem: uint8ToBase64(new Uint8Array(cipherText)),
    iv: uint8ToBase64(iv),
    ct: uint8ToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

function parseEnvelope(envelopeStr: string): DekEnvelope {
  let parsed: DekEnvelope;
  try {
    parsed = JSON.parse(envelopeStr) as DekEnvelope;
  } catch (err) {
    throw new Error("Invalid envelope: not valid JSON", { cause: err });
  }
  if (
    !parsed ||
    parsed.v !== 1 ||
    parsed.alg !== "ml-kem-768+aes-256-gcm" ||
    typeof parsed.kem !== "string" ||
    typeof parsed.iv !== "string" ||
    typeof parsed.ct !== "string"
  ) {
    throw new Error("Invalid envelope: unsupported version or missing fields");
  }
  return parsed;
}

/**
 * Unwrap a DEK envelope produced by `wrapDek`. Returns an extractable
 * AES-GCM CryptoKey so callers can re-wrap it later (edits, sharing
 * changes).
 */
export async function unwrapDek(
  envelopeStr: string,
  secretKey: Uint8Array,
): Promise<CryptoKey> {
  if (secretKey.length !== ML_KEM_SECRET_KEY_BYTES) {
    throw new Error(
      `Secret key must be exactly ${ML_KEM_SECRET_KEY_BYTES} bytes`,
    );
  }
  const envelope = parseEnvelope(envelopeStr);
  const cipherText = base64ToUint8(envelope.kem);
  if (cipherText.length !== ML_KEM_CIPHERTEXT_BYTES) {
    throw new Error(
      `KEM ciphertext must be exactly ${ML_KEM_CIPHERTEXT_BYTES} bytes`,
    );
  }
  const sharedSecretRet = ml_kem768.decapsulate(cipherText, secretKey);
  const sharedSecret = new Uint8Array(sharedSecretRet);
  try {
    const wrapKey = await importAesKeyFromSharedSecret(sharedSecret);
    const iv = base64ToUint8(envelope.iv);
    const ct = base64ToUint8(envelope.ct);
    const rawDekBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      ct,
    );
    const rawDek = new Uint8Array(rawDekBuf);
    try {
      return await crypto.subtle.importKey(
        "raw",
        rawDek,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    } finally {
      rawDek.fill(0);
    }
  } finally {
    sharedSecret.fill(0);
  }
}

export async function unwrapBytes(
  envelopeStr: string,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (secretKey.length !== ML_KEM_SECRET_KEY_BYTES) {
    throw new Error(
      `Secret key must be exactly ${ML_KEM_SECRET_KEY_BYTES} bytes`,
    );
  }
  const envelope = parseEnvelope(envelopeStr);
  const cipherText = base64ToUint8(envelope.kem);
  const sharedSecretRet = ml_kem768.decapsulate(cipherText, secretKey);
  const sharedSecret = new Uint8Array(sharedSecretRet);
  try {
    const wrapKey = await importAesKeyFromSharedSecret(sharedSecret);
    const iv = base64ToUint8(envelope.iv);
    const ct = base64ToUint8(envelope.ct);
    const rawBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      ct,
    );
    return new Uint8Array(rawBuf);
  } finally {
    sharedSecret.fill(0);
  }
}
