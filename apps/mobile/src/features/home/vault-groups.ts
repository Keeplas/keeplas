import type { IconName } from "@/components/icon";
import type { FileKind } from "@/crypto/item-meta";
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

/**
 * Home tile of a stored category (unknown → other); null for "inbox"
 * (unsorted captures), which has its own row instead of a tile.
 */
export function groupOf(category: string): VaultGroupKey | null {
  if (category === "inbox") return null;
  return (
    VAULT_GROUPS.find((g) =>
      (g.categories as readonly string[]).includes(category),
    )?.key ?? "other"
  );
}

export type ContentKind = "documents" | "notes" | "photos" | "voice" | "videos";

const KIND_OF_FILE: Record<FileKind, ContentKind> = {
  document: "documents",
  image: "photos",
  audio: "voice",
  video: "videos",
};

export function contentKind(files: readonly { kind: FileKind }[]): ContentKind {
  return files.length === 1 ? KIND_OF_FILE[files[0].kind] : "notes";
}

export type VaultListKey = VaultGroupKey | "inbox" | "all";

export function isVaultListKey(value: string): value is VaultListKey {
  return (
    value === "inbox" ||
    value === "all" ||
    VAULT_GROUPS.some((g) => g.key === value)
  );
}

export function inVaultList(category: string, list: VaultListKey): boolean {
  if (list === "all") return true;
  if (list === "inbox") return category === "inbox";
  return groupOf(category) === list;
}

/** Sum per-category counts into the four Home groups. */
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
    const group = groupOf(category);
    if (group) totals[group] += count;
  }
  return totals;
}

/** "Good morning / afternoon / evening" key for a local hour. */
export function greetingKey(hour: number): string {
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}
