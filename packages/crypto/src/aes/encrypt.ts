export interface EncryptedData {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Encrypt plaintext data using AES-256-GCM.
 * Generates a random 12-byte IV for each encryption (never reused).
 */
export async function encrypt(
  plaintext: BufferSource,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );
  return { ciphertext, iv };
}
