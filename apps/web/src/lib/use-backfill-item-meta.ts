import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "./use-vault-crypto";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useAuditedMutation } from "./use-audited-mutation";
import { fileMetaJson, itemMetaJson } from "./item-meta";

/**
 * Owner-side migration of legacy plaintext metadata (F4): seals each item's
 * category and each file's name, type, size and kind under the item DEK
 * (master key for legacy `aes_256_gcm` items), then lets the server drop the
 * plaintext columns via `backfillItemMeta`. Converges over a session and
 * no-ops once every row is sealed. Mutations run one at a time.
 */
export function useBackfillItemMeta(): void {
  const pending = useQuery(api.vault_items.getItemsNeedingMetaBackfill);
  const { encryptContent, encryptContentWithKey, isReady } = useVaultCrypto();
  const { unwrapOwnerDek, isReady: recipientReady } = useRecipientCrypto();
  const backfill = useAuditedMutation(api.vault_items.backfillItemMeta);
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pending || !isReady || !recipientReady) return;
    const todo = pending.filter((row) => !processed.current.has(row.itemId));
    if (todo.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const row of todo) {
        if (cancelled) return;
        processed.current.add(row.itemId);
        try {
          const seal = row.ownerWrappedDek
            ? await (async () => {
                const dek = await unwrapOwnerDek({
                  wrappedDek: row.ownerWrappedDek!,
                });
                return (plain: string) => encryptContentWithKey(plain, dek);
              })()
            : encryptContent;
          await backfill({
            itemId: row.itemId,
            encryptedMeta: row.category
              ? await seal(itemMetaJson(row.category))
              : undefined,
            files: await Promise.all(
              row.files.map(async ({ fileId, ...meta }) => ({
                fileId,
                encryptedMeta: await seal(fileMetaJson(meta)),
              })),
            ),
          });
        } catch {
          // Marked processed for this session to avoid hammering; a later
          // session retries from a fresh set.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pending,
    isReady,
    recipientReady,
    encryptContent,
    encryptContentWithKey,
    unwrapOwnerDek,
    backfill,
  ]);
}
