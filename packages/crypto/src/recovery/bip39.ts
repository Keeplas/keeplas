import { WORDLIST } from "./wordlist";

/**
 * Generate a 24-word BIP-39 recovery phrase from 256 bits of entropy.
 *
 * Process:
 *   1. Generate 256 random bits (32 bytes)
 *   2. Compute SHA-256 checksum of the entropy
 *   3. Append first 8 bits of checksum to entropy (264 bits total)
 *   4. Split into 24 groups of 11 bits
 *   5. Each 11-bit value maps to a word in the 2048-word BIP-39 list
 *
 * All operations are client-side only — no network calls.
 */
export async function generatePhrase(): Promise<string[]> {
  // 1. Generate 256 bits of entropy
  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);

  return entropyToPhrase(entropy);
}

/**
 * Convert raw entropy bytes to a BIP-39 mnemonic phrase.
 * Exported for testing with deterministic entropy.
 */
export async function entropyToPhrase(entropy: Uint8Array<ArrayBuffer>): Promise<string[]> {
  if (entropy.length !== 32) {
    throw new Error("Entropy must be exactly 32 bytes (256 bits)");
  }

  // 2. SHA-256 checksum
  const hashBuffer = await crypto.subtle.digest("SHA-256", entropy);
  const hashArray = new Uint8Array(hashBuffer);
  const checksumByte = hashArray[0]; // First 8 bits for 256-bit entropy

  // 3. Concatenate entropy + checksum bits into a single bit string
  // 256 bits entropy + 8 bits checksum = 264 bits = 24 × 11 bits
  const bits = new Uint8Array(264);

  // Entropy bits
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 8; j++) {
      bits[i * 8 + j] = (entropy[i] >> (7 - j)) & 1;
    }
  }

  // Checksum bits (first 8 bits of hash)
  for (let j = 0; j < 8; j++) {
    bits[256 + j] = (checksumByte >> (7 - j)) & 1;
  }

  // 4. Split into 24 groups of 11 bits, map to words
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    let index = 0;
    for (let j = 0; j < 11; j++) {
      index = (index << 1) | bits[i * 11 + j];
    }
    words.push(WORDLIST[index]);
  }

  return words;
}

/**
 * Derive a 256-bit AES-GCM CryptoKey deterministically from a BIP-39 phrase.
 *
 * Uses PBKDF2 with:
 *   - Password: the space-joined mnemonic words (normalized to lowercase)
 *   - Salt: "keeplas-vault-key" (application-specific, not user-specific)
 *   - Iterations: 600,000 (OWASP recommendation for PBKDF2-SHA256)
 *   - Hash: SHA-256
 *   - Output: 256-bit AES-GCM key
 *
 * Same phrase always produces the same key.
 */
export async function phraseToKey(words: string[]): Promise<CryptoKey> {
  if (words.length !== 24) {
    throw new Error("Recovery phrase must be exactly 24 words");
  }

  const passphrase = words.map((w) => w.toLowerCase().trim()).join(" ");
  const encoder = new TextEncoder();

  // Import passphrase as PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("keeplas-vault-key"),
      iterations: 600_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable — needed for Shamir splitting
    ["encrypt", "decrypt"]
  );
}

/**
 * Compute SHA-256 hash of a phrase for server-side verification.
 * The hash is safe to store on the server (non-reversible).
 *
 * Same phrase always produces the same hash.
 */
export async function phraseToHash(words: string[]): Promise<string> {
  if (words.length !== 24) {
    throw new Error("Recovery phrase must be exactly 24 words");
  }

  const normalized = words.map((w) => w.toLowerCase().trim()).join(" ");
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(normalized)
  );

  // Convert to hex string
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
