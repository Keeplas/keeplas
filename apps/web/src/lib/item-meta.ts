import type { VaultCategory } from "./vault-categories";
import type { FileKind } from "./attachment-capture";

/**
 * Vault metadata sealed under the item DEK (F4): the server stores no
 * plaintext category, file name, MIME type, size or kind. Legacy rows keep
 * their plaintext columns until `useBackfillItemMeta` seals them.
 */

export interface ItemMeta {
  v: 1;
  category: VaultCategory;
  icon?: string;
  /**
   * User-made category (vault_categories, created in the phone app).
   * `category` then holds the built-in fallback ("other").
   */
  categoryId?: string;
}

export interface FileMeta {
  v: 1;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;
  durationSec?: number;
}

export const itemMetaJson = (
  category: VaultCategory,
  icon?: string,
  categoryId?: string,
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
