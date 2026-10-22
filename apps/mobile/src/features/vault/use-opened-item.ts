import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
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
import { useVaultData } from "@/features/vault/vault-data";
import { errorReference } from "@/lib/file-errors";

export type Attachment = FileMeta & {
  id: Id<"vault_item_files">;
  iv: string;
};

export interface OpenedItem {
  key: CryptoKey;
  title: string;
  note: string;
  category: VaultCategory;
  icon?: string;
  files: Attachment[];
}

export function useOpenedItem(itemId: Id<"vault_items">) {
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const { itemKey } = useVaultData();
  const [opened, setOpened] = useState<OpenedItem>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<{
    attempt: number;
    reference: string;
  }>();

  useEffect(() => {
    if (!raw || !files) return;
    let alive = true;
    void (async () => {
      try {
        const key = await itemKey(raw);
        const [title, note, meta, metas] = await Promise.all([
          raw.encryptedTitle
            ? decryptText(raw.encryptedTitle, key)
            : (raw.title ?? ""),
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
        if (alive)
          setOpened({
            key,
            title,
            note,
            category: meta.category,
            icon: meta.icon,
            files: metas,
          });
      } catch (error) {
        const reference = errorReference();
        if (__DEV__) console.warn(`[item ${reference}]`, error);
        if (alive) setFailed({ attempt, reference });
      }
    })();
    return () => {
      alive = false;
    };
  }, [raw, files, itemKey, attempt]);

  return {
    raw,
    opened,
    failure: failed?.attempt === attempt ? failed.reference : undefined,
    retry: () => setAttempt((n) => n + 1),
  };
}
