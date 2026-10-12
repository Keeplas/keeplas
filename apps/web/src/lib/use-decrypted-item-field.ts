import { useEffect, useRef, useState } from "react";
import { useVaultCrypto } from "./use-vault-crypto";
import { useRecipientCrypto } from "./use-recipient-crypto";

/**
 * An item with one encrypted field. Either wrap unlocks the per-item DEK:
 * `ownerWrappedDek` on the owner's items, the recipient's `wrappedDek` on
 * the memorial path. Both absent → legacy `aes_256_gcm` item, decrypted
 * under the master key.
 */
export interface DecryptableItem {
  _id: string;
  wrappedDek?: string | null;
  ownerWrappedDek?: string | null;
}

/** How to read one field: its ciphertext and the value used without it. */
export interface FieldReader<T, V> {
  ciphertext: (item: T) => string | undefined;
  fallback: (item: T) => V;
  parse: (plaintext: string) => V;
}

/**
 * Decrypt one field across a list of items, returning `_id → value`. DEK
 * unwraps are cached by `${_id}:${ciphertext}`, so list churn and re-renders
 * don't repeat the ML-KEM work. Rows without ciphertext (not yet migrated) or
 * that fail to decrypt use the reader's fallback. `reader` must be stable
 * (module-level).
 */
export function useDecryptedItemField<T extends DecryptableItem, V>(
  items: T[] | undefined,
  reader: FieldReader<T, V>,
): Record<string, V> {
  const { decryptContent, decryptContentWithKey, isReady } = useVaultCrypto();
  const { unwrapOwnerDek, isReady: recipientReady } = useRecipientCrypto();
  const [values, setValues] = useState<Record<string, V>>({});
  const cache = useRef<Map<string, V>>(new Map());

  useEffect(() => {
    if (!items || !isReady) return;
    let cancelled = false;

    (async () => {
      const next: Record<string, V> = {};
      for (const item of items) {
        const ciphertext = reader.ciphertext(item);
        if (!ciphertext) {
          next[item._id] = reader.fallback(item);
          continue;
        }
        const cacheKey = `${item._id}:${ciphertext}`;
        if (cache.current.has(cacheKey)) {
          next[item._id] = cache.current.get(cacheKey) as V;
          continue;
        }
        const wrap = item.wrappedDek ?? item.ownerWrappedDek;
        try {
          let plain: string;
          if (wrap) {
            if (!recipientReady) {
              next[item._id] = reader.fallback(item);
              continue;
            }
            const dek = await unwrapOwnerDek({ wrappedDek: wrap });
            plain = await decryptContentWithKey(ciphertext, dek);
          } else {
            plain = await decryptContent(ciphertext);
          }
          const value = reader.parse(plain);
          cache.current.set(cacheKey, value);
          next[item._id] = value;
        } catch {
          next[item._id] = reader.fallback(item);
        }
      }
      if (!cancelled) setValues(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    items,
    reader,
    isReady,
    recipientReady,
    decryptContent,
    decryptContentWithKey,
    unwrapOwnerDek,
  ]);

  return values;
}
