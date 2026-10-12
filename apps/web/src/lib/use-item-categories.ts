import type { VaultCategory } from "./vault-categories";
import { parseItemMeta } from "./item-meta";
import {
  useDecryptedItemField,
  type DecryptableItem,
  type FieldReader,
} from "./use-decrypted-item-field";

/** An item whose category is sealed in `encryptedMeta` (F4). */
export interface CategorizedItem extends DecryptableItem {
  encryptedMeta?: string;
  category?: VaultCategory;
}

const categoryReader: FieldReader<CategorizedItem, VaultCategory> = {
  ciphertext: (item) => item.encryptedMeta,
  fallback: (item) => item.category ?? "other",
  parse: (plaintext) => parseItemMeta(plaintext).category,
};

/** Decrypt item categories, returning a map `_id → category`. */
export function useItemCategories(
  items: CategorizedItem[] | undefined,
): Record<string, VaultCategory> {
  return useDecryptedItemField(items, categoryReader);
}
