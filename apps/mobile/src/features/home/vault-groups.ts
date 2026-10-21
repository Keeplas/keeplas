import type { IconName } from "@/components/icon";
import type { FileKind, VaultCategory } from "@/crypto/item-meta";
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

export const VAULT_LISTS = [
  "all",
  "documents",
  "accounts",
  "instructions",
  "notes",
  "photos",
  "voice",
  "videos",
  "other",
  "inbox",
] as const;

export type VaultListKey = (typeof VAULT_LISTS)[number];

export function isVaultListKey(value: string): value is VaultListKey {
  return (VAULT_LISTS as readonly string[]).includes(value);
}

export const GROUP_CATEGORY = {
  inbox: "inbox",
  documents: "personal_document",
  accounts: "credential",
  instructions: "wishes",
  other: "other",
} as const satisfies Record<VaultGroupKey | "inbox", VaultCategory>;

export function presetCategory(list: VaultListKey): VaultCategory | undefined {
  return list in GROUP_CATEGORY
    ? GROUP_CATEGORY[list as keyof typeof GROUP_CATEGORY]
    : undefined;
}

interface Listed {
  category: string;
  kind: ContentKind;
}

export function bucketOf(item: Listed): Exclude<VaultListKey, "all" | "other"> {
  if (item.category === "inbox") return "inbox";
  const group = groupOf(item.category);
  if (group === "accounts" || group === "instructions") return group;
  return item.kind;
}

export function inVaultList(item: Listed, list: VaultListKey): boolean {
  if (list === "all") return true;
  if (list === "other") return groupOf(item.category) === "other";
  return bucketOf(item) === list;
}

export function listCounts(
  items: readonly Listed[],
): Record<VaultListKey, number> {
  const counts = Object.fromEntries(
    VAULT_LISTS.map((key) => [key, 0]),
  ) as Record<VaultListKey, number>;
  for (const item of items) {
    counts.all += 1;
    counts[bucketOf(item)] += 1;
    if (groupOf(item.category) === "other") counts.other += 1;
  }
  return counts;
}

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
