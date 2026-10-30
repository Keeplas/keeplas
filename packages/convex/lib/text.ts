/**
 * Longest display name kept for a user or a trusted contact. Other accounts
 * see these names (an owner's name reaches their contacts' live queries), so
 * they are capped like device labels.
 */
export const MAX_NAME_LENGTH = 100;

/** The trimmed name, cut to MAX_NAME_LENGTH. */
export function cleanName(raw: string): string {
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}
