import { useMemo } from "react";
import { useTranslations } from "@/lib/i18n";
import { CATEGORIES, type CategoryConfig } from "@/lib/vault-categories";

// Single accessor for translated category labels (hides the namespace string,
// reused across every site that renders a category name).
export function useCategoryLabel() {
  return useTranslations("vault.categories"); // (key) => string
}

// CATEGORIES sorted by translated label so the order follows the active
// language; "other" is a catch-all and always sorts last.
export function useSortedCategories(): CategoryConfig[] {
  const label = useCategoryLabel();
  return useMemo(
    () =>
      [...CATEGORIES].sort((a, b) =>
        a.key === "other"
          ? 1
          : b.key === "other"
            ? -1
            : label(a.key).localeCompare(label(b.key)),
      ),
    [label],
  );
}
