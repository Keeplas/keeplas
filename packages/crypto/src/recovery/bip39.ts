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

/** word → 11-bit index, built once for {@link validatePhrase}. */
const WORD_INDEX = new Map(WORDLIST.map((w, i) => [w, i] as const));

/**
 * Validate a 24-word BIP-39 mnemonic: every word must be in the wordlist and
 * the embedded checksum must match. This is the exact inverse of
 * {@link entropyToPhrase}.
 *
 * Used to fail fast on phrase entry (recovery flows) instead of relying on a
 * downstream verifier mismatch — a transposed/mistyped word is caught locally.
 * It does NOT prove the phrase is the *right* one (that's the salted Argon2id
 * verifier's job), only that it is a well-formed mnemonic.
 *
 * All client-side; no network calls. Returns `false` for any malformed input.
 */
export async function validatePhrase(words: string[]): Promise<boolean> {
  if (words.length !== 24) return false;

  // Map each word back to its 11-bit index → reconstruct the 264-bit string.
  const bits = new Uint8Array(264);
  for (let i = 0; i < 24; i++) {
    const word = words[i].toLowerCase().trim().normalize("NFKD");
    const index = WORD_INDEX.get(word);
    if (index === undefined) return false;
    for (let j = 0; j < 11; j++) {
      bits[i * 11 + j] = (index >> (10 - j)) & 1;
    }
  }

  // First 256 bits → 32 entropy bytes.
  const entropy = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i * 8 + j];
    }
    entropy[i] = byte;
  }

  // Last 8 bits must equal the first 8 bits of SHA-256(entropy).
  const hashBuffer = await crypto.subtle.digest("SHA-256", entropy);
  const checksumByte = new Uint8Array(hashBuffer)[0];
  for (let j = 0; j < 8; j++) {
    if (bits[256 + j] !== ((checksumByte >> (7 - j)) & 1)) return false;
  }

  return true;
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

// Domain-separation prefix for the TOTP-reset verifier. Distinct from
// PHRASE_VERIFIER_DOMAIN so the two Argon2id digests can never collide even
// though they share the same per-user salt and 24-word input.
const TOTP_RESET_DOMAIN = "keeplas-totp-reset-v2";

/**
 * Derive a STRONG, salted server-side verifier dedicated to TOTP reset.
 *
 * Mirrors {@link derivePhraseVerifier}: memory-hard Argon2id (see
 * `argon2idRaw`) with the user's per-user `salt` (reuse `users.phraseSalt`)
 * and a distinct domain prefix. This replaces the previous PBKDF2 + global
 * constant salt, which let a single precomputation attack target every user's
 * `totpResetVerifierHash` at once.
 *
 * Proves possession of the recovery phrase without coupling the TOTP-reset
 * path to vault-key derivation or the login verifier. The phrase never leaves
 * the client; the server stores only the hex verifier and compares
 * constant-time.
 *
 * Returns a 64-char lowercase hex string (32-byte Argon2id digest).
 */
export async function phraseToTotpResetVerifier(
  words: string[],
  salt: Uint8Array,
): Promise<string> {
  if (words.length !== 24) {
    throw new Error("Recovery phrase must be exactly 24 words");
  }
  const normalized = words
    .map((w) => w.toLowerCase().trim().normalize("NFKD"))
    .join(" ");
  const password = `${TOTP_RESET_DOMAIN}:${normalized}`;
  const digest = await argon2idRaw(password, salt);
  return uint8ToHex(digest);
}
