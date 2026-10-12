import {
  useDecryptedItemField,
  type DecryptableItem,
  type FieldReader,
} from "./use-decrypted-item-field";

/**
 * An item whose title may be encrypted. `title` is the legacy plaintext
 * fallback for rows the client-side backfill hasn't reached yet.
 */
export interface DecryptableTitle extends DecryptableItem {
  title?: string;
  encryptedTitle?: string;
}

const titleReader: FieldReader<DecryptableTitle, string> = {
  ciphertext: (item) => item.encryptedTitle,
  fallback: (item) => item.title ?? "",
  parse: (plaintext) => plaintext,
};

/** Decrypt a list of item titles, returning a map `_id → plaintext title`. */
export function useDecryptedTitles(
  items: DecryptableTitle[] | undefined,
): Record<string, string> {
  return useDecryptedItemField(items, titleReader);
}
