/**
 * Decrypt AES-256-GCM encrypted data.
 * Throws if the key, IV, or `additionalData` (AAD) is incorrect.
 *
 * `additionalData` must exactly match the AAD passed at encryption time;
 * any mismatch (or a missing/extra AAD) makes GCM authentication fail.
 * `tagLength: 128` is pinned to match `encrypt`.
 */
export async function decrypt(
  ciphertext: BufferSource,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  additionalData?: BufferSource,
): Promise<ArrayBuffer> {
  const params: AesGcmParams = { name: "AES-GCM", iv, tagLength: 128 };
  if (additionalData !== undefined) {
    params.additionalData = additionalData;
  }
  return crypto.subtle.decrypt(params, key, ciphertext);
}
