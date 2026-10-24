/**
 * Vault metadata sealed under the item DEK (F4), same JSON as the web
 * (apps/web/src/lib/item-meta.ts): the server stores no plaintext category,
 * file name, MIME type, size or kind. Legacy rows keep plaintext columns
 * until a client backfills them (`vault_items.backfillItemMeta`).
 */
import type { VaultCategory } from "@keeplas/backend/shared_types";

export type { VaultCategory };

export type FileKind = "document" | "audio" | "video" | "image";

export interface ItemMeta {
  v: 1;
  category: VaultCategory;
  icon?: string;
  /**
   * User-made category (vault_categories). `category` then holds the
   * built-in fallback ("other") for readers that do not know it.
   */
  categoryId?: string;
}

/** Where an item is filed: a built-in category, or a user-made one. */
export type CategoryChoice = Pick<ItemMeta, "category" | "categoryId">;

/** Built-in category of items filed under a user-made category. */
export const CUSTOM_FALLBACK: VaultCategory = "other";

export interface FileMeta {
  v: 1;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;
  durationSec?: number;
}

/** Captures waiting to be sorted (the encrypted inbox). */
export const INBOX: VaultCategory = "inbox";

export const itemMetaJson = (
  { category, categoryId }: CategoryChoice,
  icon?: string,
): string =>
  JSON.stringify({
    v: 1,
    category,
    ...(icon ? { icon } : {}),
    ...(categoryId ? { categoryId } : {}),
  } satisfies ItemMeta);

export const fileMetaJson = (meta: Omit<FileMeta, "v"> | FileMeta): string =>
  JSON.stringify({ ...meta, v: 1 } satisfies FileMeta);

export const parseItemMeta = (json: string): ItemMeta =>
  JSON.parse(json) as ItemMeta;

export const parseFileMeta = (json: string): FileMeta =>
  JSON.parse(json) as FileMeta;

/** Metadata of a legacy file row that was never sealed. */
export function legacyFileMeta(file: {
  name?: string;
  mimeType?: string;
  size?: number;
  kind?: FileKind;
  durationSec?: number;
}): FileMeta {
  return {
    v: 1,
    name: file.name ?? "",
    mimeType: file.mimeType ?? "application/octet-stream",
    size: file.size ?? 0,
    kind: file.kind ?? "document",
    durationSec: file.durationSec,
  };
}

/** Web attachment kinds from a MIME type (apps/web attachment-capture). */
export function fileKindOf(mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}
