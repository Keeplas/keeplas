import { useEffect, useRef, useState } from "react";
import { useVaultCrypto } from "./use-vault-crypto";
import { useRecipientCrypto } from "./use-recipient-crypto";

/**
 * An item whose title may be encrypted. Either wrap field unlocks the per-item
 * DEK: `ownerWrappedDek` on the owner's own items, the recipient's `wrappedDek`
 * on the memorial path. Both absent → legacy `aes_256_gcm` item, decrypted
 * under the master key. `title` is the legacy plaintext fallback for rows the
 * client-side backfill hasn't reached yet.
 */
export interface DecryptableTitle {
  _id: string;
  title?: string;
  encryptedTitle?: string;
  wrappedDek?: string | null;
  ownerWrappedDek?: string | null;
}

/**
 * Decrypt a list of item titles, returning a map `_id → plaintext title`.
 * Reuses the same crypto path as content (`decryptContentWithKey` +
 * `unwrapOwnerDek`); DEK unwraps are cached by `${_id}:${encryptedTitle}` so
 * list churn and re-renders don't repeat the ML-KEM work, and an edited title
 * re-decrypts on its own. Un-migrated rows fall back to their plaintext title.
 */
export function useDecryptedTitles(
  items: DecryptableTitle[] | undefined,
): Record<string, string> {
  const { decryptContent, decryptContentWithKey, isReady } = useVaultCrypto();
  const { unwrapOwnerDek, isReady: recipientReady } = useRecipientCrypto();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const cache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!items || !isReady) return;
    let cancelled = false;

    (async () => {
      const next: Record<string, string> = {};
      for (const item of items) {
        if (!item.encryptedTitle) {
          next[item._id] = item.title ?? "";
          continue;
        }
        const cacheKey = `${item._id}:${item.encryptedTitle}`;
        const cached = cache.current.get(cacheKey);
        if (cached !== undefined) {
          next[item._id] = cached;
          continue;
        }
        const wrap = item.wrappedDek ?? item.ownerWrappedDek;
        try {
          let plain: string;
          if (wrap) {
            if (!recipientReady) {
              next[item._id] = item.title ?? "";
              continue;
            }
            const dek = await unwrapOwnerDek({ wrappedDek: wrap });
            plain = await decryptContentWithKey(item.encryptedTitle, dek);
          } else {
            plain = await decryptContent(item.encryptedTitle);
          }
          cache.current.set(cacheKey, plain);
          next[item._id] = plain;
        } catch {
          next[item._id] = item.title ?? "";
        }
      }
      if (!cancelled) setTitles(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    items,
    isReady,
    recipientReady,
    decryptContent,
    decryptContentWithKey,
    unwrapOwnerDek,
  ]);

  return titles;
}
