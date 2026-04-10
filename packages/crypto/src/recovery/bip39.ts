/**
 * Generate a 24-word BIP-39 recovery phrase (256-bit entropy).
 *
 * TODO: Implement with standard BIP-39 English wordlist in Phase 2.
 */
export async function generatePhrase(): Promise<string[]> {
  throw new Error("Not implemented — Phase 2");
}

/**
 * Derive a CryptoKey deterministically from a BIP-39 phrase.
 */
export async function phraseToKey(
  _words: string[]
): Promise<CryptoKey> {
  throw new Error("Not implemented — Phase 2");
}

/**
 * Compute SHA-256 hash of a phrase for server-side verification.
 * The hash is safe to store on the server (non-reversible).
 */
export async function phraseToHash(
  _words: string[]
): Promise<string> {
  throw new Error("Not implemented — Phase 2");
}
