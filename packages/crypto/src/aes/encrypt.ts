export interface EncryptedData {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Encrypt plaintext data using AES-256-GCM.
 * Generates a random 12-byte IV for each encryption (never reused).
 *
 * `additionalData` (AAD) is authenticated but NOT encrypted — pass envelope
 * headers / context (e.g. item id, version) to cryptographically bind them to
 * the ciphertext. The exact same AAD must be supplied to `decrypt`, otherwise
 * authentication fails. `tagLength: 128` is set explicitly (the WebCrypto
 * default, pinned here so the tag size can never silently change).
 */
export async function encrypt(
  plaintext: BufferSource,
  key: CryptoKey,
  additionalData?: BufferSource,
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params: AesGcmParams = { name: "AES-GCM", iv, tagLength: 128 };
  if (additionalData !== undefined) {
    params.additionalData = additionalData;
  }
  const ciphertext = await crypto.subtle.encrypt(params, key, plaintext);
  return { ciphertext, iv };
}
