import type { Id } from "@keeplas/backend/_generated/dataModel";

import { decryptText } from "@/crypto/envelope";
import {
  legacyFileMeta,
  parseFileMeta,
  parseItemMeta,
  type FileMeta,
  type ItemMeta,
  type VaultCategory,
} from "@/crypto/item-meta";

export type Attachment = FileMeta & {
  id: Id<"vault_item_files">;
  iv: string;
};

export interface OpenedItem {
  key: CryptoKey;
  title: string;
  note: string;
  category: VaultCategory;
  categoryId?: string;
  icon?: string;
  files: Attachment[];
}

/** The sealed columns of an item row (mine, or one released to me). */
export interface SealedItem {
  title?: string;
  encryptedTitle?: string;
  encryptedContent: string;
  encryptedMeta?: string;
  category?: VaultCategory;
}

/** A file row: sealed metadata, or the plaintext columns of a legacy row. */
export type SealedFile = Parameters<typeof legacyFileMeta>[0] & {
  _id: Id<"vault_item_files">;
  iv: string;
  encryptedMeta?: string;
};

/** An item's title: sealed (F4), or the plaintext column of a legacy row. */
export async function openTitle(
  raw: Pick<SealedItem, "title" | "encryptedTitle">,
  key: CryptoKey,
): Promise<string> {
  return raw.encryptedTitle
    ? decryptText(raw.encryptedTitle, key)
    : (raw.title ?? "");
}

/** Decrypt an item and its file metadata with the key that opens it. */
export async function openSealedItem(
  raw: SealedItem,
  files: readonly SealedFile[],
  key: CryptoKey,
): Promise<OpenedItem> {
  const [title, note, meta, metas] = await Promise.all([
    openTitle(raw, key),
    decryptText(raw.encryptedContent, key),
    raw.encryptedMeta
      ? decryptText(raw.encryptedMeta, key).then(parseItemMeta)
      : ({ v: 1, category: raw.category ?? "other" } as ItemMeta),
    Promise.all(
      files.map(async (file) => ({
        ...(file.encryptedMeta
          ? parseFileMeta(await decryptText(file.encryptedMeta, key))
          : legacyFileMeta(file)),
        id: file._id,
        iv: file.iv,
      })),
    ),
  ]);
  return {
    key,
    title,
    note,
    category: meta.category,
    categoryId: meta.categoryId,
    icon: meta.icon,
    files: metas,
  };
}
