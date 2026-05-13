/**
 * Generate a 256-bit AES-GCM Master Key using Web Crypto API.
 * This key NEVER leaves the client unencrypted.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}
