/**
 * RSA-OAEP keypair management for per-recipient DEK wrapping.
 *
 * The keypair is the user's identity for receiving wrapped data encryption
 * keys. The public key is shared with the vault owner; the private key
 * stays client-side, encrypted at rest under the user's master key.
 */

const RSA_ALGO = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

const RSA_USAGES_PRIVATE = ["unwrapKey", "decrypt"] as const;
const RSA_USAGES_PUBLIC = ["wrapKey", "encrypt"] as const;

export interface RsaKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateRsaKeypair(): Promise<RsaKeypair> {
  const pair = await crypto.subtle.generateKey(RSA_ALGO, true, [
    ...RSA_USAGES_PRIVATE,
    ...RSA_USAGES_PUBLIC,
  ]);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/**
 * Export the public key as a base64-encoded SPKI string for transport
 * and storage in the database.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

export async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(spkiBase64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "spki",
    bytes,
    RSA_ALGO,
    false,
    [...RSA_USAGES_PUBLIC]
  );
}

/**
 * Export the private key as a JWK so it can be stored
 * (after symmetric encryption with the user's master key) on the server.
 */
export async function exportPrivateKeyJwk(privateKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey("jwk", privateKey);
}

export async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    RSA_ALGO,
    true,
    [...RSA_USAGES_PRIVATE]
  );
}
