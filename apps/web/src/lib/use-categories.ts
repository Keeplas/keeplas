import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { groupOf } from "@keeplas/backend/lib/vault_groups";
import { useTranslations } from "@/lib/i18n";
import { CATEGORIES, type CategoryConfig } from "@/lib/vault-categories";

const NO_GROUPS: never[] = [];

/** Built-in category groups the user deleted in Settings → Categories. */
export function useHiddenCategoryGroups() {
  return useQuery(api.users.viewer)?.hiddenCategoryGroups ?? NO_GROUPS;
}

// Single accessor for translated category labels (hides the namespace string,
// reused across every site that renders a category name).
export function useCategoryLabel() {
  return useTranslations("vault.categories"); // (key) => string
}

// The built-in categories the user kept (To sort always stays), sorted by
// translated label so the order follows the active language; "other" is a
// catch-all and always sorts last.
export function useSortedCategories(): CategoryConfig[] {
  const label = useCategoryLabel();
  const hidden = useHiddenCategoryGroups();
  return useMemo(
    () =>
      CATEGORIES.filter((category) => {
        const group = groupOf(category.key);
        return !group || !hidden.includes(group);
      }).sort((a, b) =>
        a.key === "other"
          ? 1
          : b.key === "other"
            ? -1
            : label(a.key).localeCompare(label(b.key)),
      ),
    [label, hidden],
  );
}
