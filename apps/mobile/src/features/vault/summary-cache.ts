/**
 * On-device cache of decrypted vault item summaries (title + category only,
 * never content) in the SQLCipher database. Two jobs:
 *
 * - show the vault immediately after unlock — and offline — instead of
 *   waiting for the network;
 * - skip the per-item ML-KEM decapsulation at every launch: unchanged items
 *   (same `updatedAt`) are served from here.
 *
 * Cleared on sign-out. Auto-lock keeps it: the database key lives in the
 * Keychain/Keystore, the same trust boundary as the wrapped vault key.
 */
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { secureDb } from "@/lib/secure-db";
import type { VaultCategory } from "@/crypto/item-meta";
import type { VaultItemSummary } from "./vault-data";

export async function loadItemSummaries(
  userId: string,
): Promise<VaultItemSummary[]> {
  const { rows } = await (
    await secureDb()
  ).execute(
    `SELECT id, title, category, folder_id, created_at, updated_at
     FROM item_summaries WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id) as Id<"vault_items">,
    title: String(row.title),
    category: String(row.category) as VaultCategory,
    folderId: row.folder_id
      ? (String(row.folder_id) as Id<"folders">)
      : undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

/** Replace the user's cached summaries. Undecryptable rows are not kept. */
export async function saveItemSummaries(
  userId: string,
  items: VaultItemSummary[],
): Promise<void> {
  const db = await secureDb();
  await db.transaction(async (tx) => {
    await tx.execute("DELETE FROM item_summaries WHERE user_id = ?", [userId]);
    for (const item of items) {
      if (item.title === null) continue;
      await tx.execute(
        `INSERT INTO item_summaries
           (id, user_id, title, category, folder_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          userId,
          item.title,
          item.category,
          item.folderId ?? null,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
  });
}

export async function clearItemSummaries(userId: string): Promise<void> {
  await (
    await secureDb()
  ).execute("DELETE FROM item_summaries WHERE user_id = ?", [userId]);
}
