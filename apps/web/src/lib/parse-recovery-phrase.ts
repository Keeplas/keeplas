/**
 * Parse a user-pasted recovery phrase into a normalized list of words.
 *
 * Accepts free-form input (copy/paste from the PDF, manual typing,
 * QR scan output) and returns lowercase alphabetic tokens only.
 *
 * BIP39 English words are pure a-z, so digits and punctuation are stripped —
 * this lets users paste the PDF format ("01. word1 02. word2 ...") directly
 * without having to clean it up by hand.
 */
export function parseRecoveryPhrase(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
