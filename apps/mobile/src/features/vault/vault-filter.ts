import { CUSTOM_FALLBACK } from "@/crypto/item-meta";
import type { AddPreset } from "@/features/capture/add-sheet";
import {
  inVaultList,
  isVaultListKey,
  presetCategory,
  type ContentKind,
} from "@/features/home/vault-groups";

/**
 * A vault filter is a built-in list key (a Vault chip, a Home tile) or the
 * id of a user-made category. The Vault chips and the category pages share
 * these rules.
 */
export function inFilter(
  item: { category: string; kind: ContentKind; categoryId?: string },
  filter: string,
): boolean {
  return isVaultListKey(filter)
    ? inVaultList(item, filter)
    : item.categoryId === filter;
}

/** Where an item added from a filter is filed. */
export function filterPreset(filter: string): AddPreset {
  return isVaultListKey(filter)
    ? { category: presetCategory(filter) }
    : { category: CUSTOM_FALLBACK, categoryId: filter };
}

/** Item count of each user-made category, by category id. */
export function categoryCounts(
  items: readonly { categoryId?: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { categoryId } of items) {
    if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  return counts;
}
