import { useEffect, useRef } from "react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { useVaultCrypto } from "./use-vault-crypto";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useAuditedMutation } from "./use-audited-mutation";

/**
 * One-shot, owner-side migration of legacy plaintext titles to `encryptedTitle`.
 * The server holds no key, so the owner's client encrypts each un-migrated title
 * under the item's DEK (master key for legacy `aes_256_gcm` items) and drops the
 * plaintext copy via `backfillItemTitle`. Runs whenever the owner's item list is
 * in memory; converges over a session and no-ops once every row is migrated.
 *
 * Pass the same `getItems` result the screen already subscribes to — no extra
 * query. Mutations run sequentially to stay gentle on a large vault.
 */
export function useBackfillItemTitles(
  items: Doc<"vault_items">[] | undefined,
): void {
  const { encryptContent, encryptContentWithKey, isReady } = useVaultCrypto();
  const { unwrapOwnerDek, isReady: recipientReady } = useRecipientCrypto();
  const backfill = useAuditedMutation(api.vault_items.backfillItemTitle);
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!items || !isReady) return;
    const pending = items.filter(
      (item) =>
        !item.encryptedTitle &&
        item.title !== undefined &&
        !processed.current.has(item._id),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of pending) {
        if (cancelled) return;
        processed.current.add(item._id);
        try {
          let encryptedTitle: string;
          if (item.ownerWrappedDek) {
            // ZK item: encrypt under the same DEK already wrapped to the owner
            // and recipients, so shared titles stay readable post-release.
            if (!recipientReady) {
              processed.current.delete(item._id);
              continue;
            }
            const dek = await unwrapOwnerDek({
              wrappedDek: item.ownerWrappedDek,
            });
            encryptedTitle = await encryptContentWithKey(item.title ?? "", dek);
          } else {
            encryptedTitle = await encryptContent(item.title ?? "");
          }
          await backfill({ itemId: item._id, encryptedTitle });
        } catch {
          // Leave it marked processed for this session to avoid hammering;
          // a later session retries from a fresh `processed` set.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    items,
    isReady,
    recipientReady,
    encryptContent,
    encryptContentWithKey,
    unwrapOwnerDek,
    backfill,
  ]);
}
