import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";

import { decryptText, encryptText } from "@/crypto/envelope";
import {
  CUSTOM_FALLBACK,
  itemMetaJson,
  parseItemMeta,
} from "@/crypto/item-meta";
import { useAuditedMutation } from "@/lib/use-audited-mutation";

type ItemDoc = FunctionReturnType<
  typeof api.vault_items.getItemSummaries
>[number];

/**
 * Folders became categories: once per unlocked session, turn each former
 * folder into a vault category, seal that category into the metadata of its
 * items (only this phone holds their keys), then delete the folder. Every
 * step is idempotent, so an interrupted run resumes on the next unlock.
 */
export function useAdoptFolders(
  rawItems: ItemDoc[] | undefined,
  itemKey: (item: { ownerWrappedDek?: string }) => Promise<CryptoKey>,
  unlocked: boolean,
) {
  const folders = useQuery(api.folders.list);
  const adopt = useAuditedMutation(api.folders.adopt);
  const migrateItem = useAuditedMutation(api.folders.migrateItem);
  const remove = useAuditedMutation(api.folders.remove);
  const started = useRef(false);

  useEffect(() => {
    if (!unlocked || !folders?.length || !rawItems || started.current) return;
    started.current = true;
    void (async () => {
      for (const folder of folders) {
        const categoryId = await adopt({ folderId: folder._id });
        for (const item of rawItems) {
          if (item.folderId !== folder._id) continue;
          const key = await itemKey(item);
          const meta = item.encryptedMeta
            ? parseItemMeta(await decryptText(item.encryptedMeta, key))
            : undefined;
          await migrateItem({
            itemId: item._id,
            encryptedMeta: await encryptText(
              itemMetaJson(
                { category: CUSTOM_FALLBACK, categoryId },
                meta?.icon,
              ),
              key,
            ),
          });
        }
        await remove({ folderId: folder._id });
      }
    })().catch(() => undefined);
  }, [unlocked, folders, rawItems, itemKey, adopt, migrateItem, remove]);
}
