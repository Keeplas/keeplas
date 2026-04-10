/**
 * Decrypt AES-256-GCM encrypted data.
 * Throws if the key or IV is incorrect.
 */
export async function decrypt(
  ciphertext: BufferSource,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
