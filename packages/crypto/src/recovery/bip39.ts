import { argon2idRaw } from "../kdf";
import { uint8ToHex } from "../encoding";
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
export async function entropyToPhrase(
  entropy: Uint8Array<ArrayBuffer>,
): Promise<string[]> {
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

// Domain-separation prefix so the salted verifier digest can never collide
// with any other Argon2id-derived secret in the system (root key, device
// wrap key, TOTP reset). Mixed into the Argon2id password input.
const PHRASE_VERIFIER_DOMAIN = "keeplas-phrase-verifier-v1";

const PHRASE_VERIFIER_SALT_BYTES = 16;

/**
 * Generate a fresh per-user random salt for {@link derivePhraseVerifier}.
 *
 * The salt is NOT secret and is stored server-side alongside the verifier;
 * its only job is to make every user's Argon2id digest unique so a single
 * DB-wide precomputation / rainbow table cannot attack all users at once.
 */
export function generatePhraseVerifierSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(PHRASE_VERIFIER_SALT_BYTES));
}

/**
 * Derive a STRONG, salted server-side verifier for the 24-word recovery
 * phrase.
 *
 * Uses the shared OWASP-tuned Argon2id (see `argon2idRaw`) with a per-user
 * random `salt` and a domain-separation prefix, so:
 *   - identical phrases across users yield different verifiers (salt), and
 *   - the verifier is memory-hard to brute-force on DB compromise (unlike
 *     a bare unsalted SHA-256 of the phrase).
 *
 * The phrase never leaves the client. The server stores only `salt` and the
 * returned hex verifier, and compares with a constant-time check.
 *
 * Returns a 64-char lowercase hex string (32-byte Argon2id digest).
 */
export async function derivePhraseVerifier(
  words: string[],
  salt: Uint8Array,
): Promise<string> {
  if (words.length !== 24) {
    throw new Error("Recovery phrase must be exactly 24 words");
  }
  const normalized = words
    .map((w) => w.toLowerCase().trim().normalize("NFKD"))
    .join(" ");
  const password = `${PHRASE_VERIFIER_DOMAIN}:${normalized}`;
  const digest = await argon2idRaw(password, salt);
  return uint8ToHex(digest);
}

/**
 * Derive a SHA-256 hex verifier dedicated to TOTP reset.
 *
 * Uses PBKDF2 with a domain-separated salt (`"keeplas-totp-reset-v1"`),
 * distinct from any other derivation. Output bytes are then
 * SHA-256-hashed so what's stored server-side is irreversible.
 *
 * The verifier proves possession of the recovery phrase without coupling
 * the TOTP-reset path with vault-key derivation or the login verifier.
 */
export async function phraseToTotpResetVerifier(
  words: string[],
): Promise<string> {
  if (words.length !== 24) {
    throw new Error("Recovery phrase must be exactly 24 words");
  }

  const passphrase = words.map((w) => w.toLowerCase().trim()).join(" ");
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode("keeplas-totp-reset-v1"),
      iterations: 600_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashBuffer = await crypto.subtle.digest("SHA-256", derivedBits);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
