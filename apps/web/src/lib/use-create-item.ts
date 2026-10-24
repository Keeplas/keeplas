import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { itemMetaJson } from "./item-meta";
import { useAuditedMutation } from "./use-audited-mutation";
import { sharingFields, useItemSharing } from "./use-item-sharing";
import { useVaultCrypto } from "./use-vault-crypto";
import { useUploadQueue, type QueuedFile } from "./upload-queue";
import type { VaultCategory } from "./vault-categories";

export interface NewItem {
  title: string;
  /** Rich-text note (HTML), "" for none. */
  note: string;
  category: VaultCategory;
  folderId: Id<"folders"> | null;
  /** Who can open it once released; [] keeps it private. */
  contactIds: Id<"trusted_contacts">[];
  files: QueuedFile[];
  /**
   * Passed on to every trusted contact, today's and future ones
   * (`contactIds` = today's, for their keys).
   */
  everyone?: boolean;
  /** Life check welcome message (memorial page, not the vault list). */
  releaseIntroduction?: boolean;
}

/**
 * Seals a new item in this browser (fresh DEK wrapped to the owner and the
 * chosen contacts) and queues it: its files upload
 * first, then the item is created with them. Returns the upload job id, or
 * null when the owner cancelled a blocked key check.
 */
export function useCreateItem() {
  const vault = useQuery(api.vaults.getVault);
  const createItem = useAuditedMutation(api.vault_items.createItem);
  const { encryptContentWithKey } = useVaultCrypto();
  const { wrap, announcePending } = useItemSharing();
  const { enqueueNewItem } = useUploadQueue();

  return useCallback(
    async (item: NewItem, inBackground = false): Promise<string | null> => {
      if (!vault) throw new Error("Vault not ready");
      const wraps = await wrap(item.contactIds);
      if (!wraps) return null;
      const seal = (plaintext: string) =>
        encryptContentWithKey(plaintext, wraps.dek);
      const [encryptedTitle, encryptedMeta, encryptedContent] =
        await Promise.all([
          seal(item.title.trim()),
          seal(itemMetaJson(item.category)),
          seal(item.note),
        ]);
      const sharing = item.everyone
        ? {
            accessLevel: "trusted_only" as const,
            recipientMode: "default" as const,
            sharedWithContacts: [],
            sharedWithGroups: [],
          }
        : sharingFields(item.contactIds);

      return enqueueNewItem(
        {
          label: item.title.trim(),
          dek: wraps.dek,
          files: item.files,
          create: async (files) => {
            const itemId = await createItem({
              vaultId: vault._id,
              encryptedTitle,
              encryptedMeta,
              encryptedContent,
              encryptionType: "zero_knowledge",
              ownerWrappedDek: wraps.ownerWrappedDek,
              ...sharing,
              recipientKeys: wraps.recipientKeys,
              pendingRecipients: wraps.pendingRecipients,
              folderId: item.folderId ?? undefined,
              files,
              isReleaseIntroduction: item.releaseIntroduction || undefined,
            });
            announcePending(wraps);
            return itemId as Id<"vault_items">;
          },
        },
        inBackground,
      );
    },
    [
      vault,
      wrap,
      encryptContentWithKey,
      enqueueNewItem,
      createItem,
      announcePending,
    ],
  );
}
