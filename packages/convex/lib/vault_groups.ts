import type { VaultCategory } from "../shared_types";

/**
 * How the apps sort vault items: the four Home tiles (M08-5), the vault list
 * filters (M10-1, W06-1) and their counts. Shared by apps/mobile and apps/web
 * so both classify an item the same way. Pure: no icons, colors or copy.
 */

export type FileKind = "document" | "audio" | "video" | "image";

export const GROUP_CATEGORIES = {
  documents: [
    "personal_document",
    "legal_document",
    "insurance_policy",
    "property",
  ],
  accounts: ["financial_asset", "digital_asset", "credential", "subscription"],
  instructions: [
    "wishes",
    "conditional_message",
    "health_directive",
    "business_continuity",
  ],
  other: ["contacts", "other"],
} as const satisfies Record<string, readonly VaultCategory[]>;

export type VaultGroupKey = keyof typeof GROUP_CATEGORIES;

const GROUP_KEYS = Object.keys(GROUP_CATEGORIES) as VaultGroupKey[];

/**
 * Home tile of a stored category (unknown → other); null for "inbox"
 * (unsorted captures), which has its own row instead of a tile.
 */
export function groupOf(category: string): VaultGroupKey | null {
  if (category === "inbox") return null;
  return (
    GROUP_KEYS.find((key) =>
      (GROUP_CATEGORIES[key] as readonly string[]).includes(category),
    ) ?? "other"
  );
}

/**
 * Where an item is shown: in the inbox when the user deleted its category
 * in Settings (a built-in one, or a user-made one no longer in
 * `categoryIds`, which is undefined while still loading).
 */
export function shownFiling<
  T extends { category: string; categoryId?: string },
>(
  item: T,
  hidden: readonly VaultGroupKey[],
  categoryIds: readonly string[] | undefined,
): T {
  if (item.categoryId) {
    return !categoryIds || categoryIds.includes(item.categoryId)
      ? item
      : { ...item, category: "inbox", categoryId: undefined };
  }
  const group = groupOf(item.category);
  return group && hidden.includes(group)
    ? { ...item, category: "inbox" }
    : item;
}

export type ContentKind = "documents" | "notes" | "photos" | "voice" | "videos";

const KIND_OF_FILE: Record<FileKind, ContentKind> = {
  document: "documents",
  image: "photos",
  audio: "voice",
  video: "videos",
};

/** One attachment types the item by its file; none or several make a note. */
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

/** Category a capture gets when it is added from a tile or a list. */
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
  /** User-made category: listed under it and by its content kind only. */
  categoryId?: string;
}

/**
 * The one list an item belongs to besides "all" (and "other"): the inbox,
 * the documents, accounts or instructions group, or else its content kind.
 */
export function bucketOf(item: Listed): Exclude<VaultListKey, "all" | "other"> {
  if (item.categoryId) return item.kind;
  if (item.category === "inbox") return "inbox";
  const group = groupOf(item.category);
  if (group && group !== "other") return group;
  return item.kind;
}

/** Whether an item is filed under a built-in group (not a user-made one). */
export function inGroup(
  item: { category: string; categoryId?: string },
  group: VaultGroupKey,
): boolean {
  return !item.categoryId && groupOf(item.category) === group;
}

export function inVaultList(item: Listed, list: VaultListKey): boolean {
  if (list === "all") return true;
  if (list === "other") return inGroup(item, "other");
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
    if (inGroup(item, "other")) counts.other += 1;
  }
  return counts;
}
