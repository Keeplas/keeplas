import type { IconName } from "@/components/icon";
import type { colors } from "@/theme";

/**
 * v2 Home groups the stored item categories into four tiles (M08-5).
 * Category values are `categoryValidator` in packages/convex/validators.ts.
 */
export const VAULT_GROUPS = [
  {
    key: "documents",
    icon: "document",
    color: "document",
    categories: [
      "personal_document",
      "legal_document",
      "insurance_policy",
      "property",
    ],
  },
  {
    key: "accounts",
    icon: "user-circle",
    color: "account",
    categories: [
      "financial_asset",
      "digital_asset",
      "credential",
      "subscription",
    ],
  },
  {
    key: "instructions",
    icon: "document",
    color: "instruction",
    categories: [
      "wishes",
      "conditional_message",
      "health_directive",
      "business_continuity",
    ],
  },
  {
    key: "other",
    icon: "folder",
    color: "other",
    categories: ["contacts", "other"],
  },
] as const satisfies readonly {
  key: string;
  icon: IconName;
  color: keyof typeof colors.category;
  categories: readonly string[];
}[];

export type VaultGroupKey = (typeof VAULT_GROUPS)[number]["key"];

/** Sum per-category counts into the four Home groups (unknown → other). */
export function groupCategoryCounts(
  counts: Record<string, number>,
): Record<VaultGroupKey, number> {
  const totals: Record<VaultGroupKey, number> = {
    documents: 0,
    accounts: 0,
    instructions: 0,
    other: 0,
  };
  for (const [category, count] of Object.entries(counts)) {
    const group =
      VAULT_GROUPS.find((g) =>
        (g.categories as readonly string[]).includes(category),
      )?.key ?? "other";
    totals[group] += count;
  }
  return totals;
}

/** "Good morning / afternoon / evening" key for a local hour. */
export function greetingKey(hour: number): string {
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}
