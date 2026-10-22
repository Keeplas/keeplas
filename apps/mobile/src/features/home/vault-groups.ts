import type { IconName } from "@/components/icon";
import type { colors } from "@/theme";
import { GROUP_CATEGORIES } from "@keeplas/backend/lib/vault_groups";

export {
  bucketOf,
  contentKind,
  GROUP_CATEGORY,
  groupOf,
  inVaultList,
  isVaultListKey,
  listCounts,
  presetCategory,
  VAULT_LISTS,
  type ContentKind,
  type VaultGroupKey,
  type VaultListKey,
} from "@keeplas/backend/lib/vault_groups";

/**
 * v2 Home tiles (M08-5): the shared category groups with their icon and
 * color. Grouping rules live in packages/convex/lib/vault_groups.ts.
 */
export const VAULT_GROUPS = [
  {
    key: "documents",
    icon: "document",
    color: "document",
    categories: GROUP_CATEGORIES.documents,
  },
  {
    key: "accounts",
    icon: "user-circle",
    color: "account",
    categories: GROUP_CATEGORIES.accounts,
  },
  {
    key: "instructions",
    icon: "document",
    color: "instruction",
    categories: GROUP_CATEGORIES.instructions,
  },
  {
    key: "other",
    icon: "folder",
    color: "other",
    categories: GROUP_CATEGORIES.other,
  },
] as const satisfies readonly {
  key: keyof typeof GROUP_CATEGORIES;
  icon: IconName;
  color: keyof typeof colors.category;
  categories: readonly string[];
}[];

const RECENT_DAYS = 30;
const RECENT_MAX = 3;

export function recentItems<T extends { updatedAt: number }>(
  items: readonly T[],
  now: number = Date.now(),
): T[] {
  const since = now - RECENT_DAYS * 86_400_000;
  return items
    .filter((item) => item.updatedAt >= since)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_MAX);
}

/** "Good morning / afternoon / evening" key for a local hour. */
export function greetingKey(hour: number): string {
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}
