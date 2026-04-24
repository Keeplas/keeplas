import { uint8ToBase64, base64ToUint8 } from "../encoding";

/**
 * A DEK (data encryption key) wrapped with a recipient's RSA public key.
 * Both fields are base64 — `wrappedDek` is the RSA-OAEP ciphertext over
 * the raw 32-byte AES key, `wrappedDekIv` is reserved for future hybrid
 * schemes. Today we encode an empty IV (single-call OAEP needs none).
 */
export interface WrappedDek {
  wrappedDek: string;
  wrappedDekIv: string;
}

/**
 * Wrap a symmetric DEK to a recipient's RSA-OAEP public key.
 * The DEK must be exportable (createdItem with `extractable=true`).
 */
export async function wrapDek(
  dek: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<WrappedDek> {
  const raw = await crypto.subtle.exportKey("raw", dek);
  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    raw
  );
  return {
    wrappedDek: uint8ToBase64(new Uint8Array(wrapped)),
    wrappedDekIv: "",
  };
}

/**
 * Unwrap a DEK previously produced by {@link wrapDek}. The result is a
 * non-extractable AES-GCM key suitable for content decryption.
 */
export async function unwrapDek(
  wrapped: WrappedDek,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const ciphertext = base64ToUint8(wrapped.wrappedDek);
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    recipientPrivateKey,
    ciphertext
  );
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
