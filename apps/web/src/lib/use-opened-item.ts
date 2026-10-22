import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { parseItemMeta } from "./item-meta";
import { parseLinks } from "./link-payload";
import { useMasterKey } from "./master-key-context";
import { useOpenedFiles, type OpenedFile } from "./use-opened-files";
import { useVaultCrypto } from "./use-vault-crypto";
import { useVaultData } from "./vault-data";
import type { VaultCategory } from "./vault-categories";
import type { VaultItemSummary } from "./vault-list";
import { contentKind } from "@keeplas/backend/lib/vault_groups";

export interface OpenedItem {
  title: string;
  /** Rich-text note (HTML) or legacy plain text; "" when empty. */
  note: string;
  links: string[];
  category: VaultCategory;
  icon?: string;
  /** The DEK, or the master key for a legacy (pre-ZK) item. */
  key: CryptoKey;
  /** Legacy item under the master key: it cannot be shared until re-keyed. */
  legacy: boolean;
}

/**
 * One owner item with its sealed fields opened in this browser: `raw` is
 * undefined while loading and null when missing; `opened` is undefined while
 * decrypting; `failed` when the item's key does not open it here.
 */
export function useOpenedItem(itemId: Id<"vault_items">): {
  raw: Doc<"vault_items"> | null | undefined;
  opened: OpenedItem | undefined;
  files: OpenedFile[] | undefined;
  failed: boolean;
} {
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const rawFiles = useQuery(api.vault_items.getItemFiles, { itemId });
  const { itemKey } = useVaultData();
  const { masterKey } = useMasterKey();
  const { decryptContent, decryptContentWithKey } = useVaultCrypto();
  const [opened, setOpened] = useState<OpenedItem>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!raw || !masterKey) return;
    let alive = true;
    (async () => {
      try {
        const key = await itemKey(raw);
        const legacy = key === masterKey;
        const open = (payload: string) =>
          legacy
            ? decryptContent(payload)
            : decryptContentWithKey(payload, key);
        const [title, note, links, meta] = await Promise.all([
          raw.encryptedTitle ? open(raw.encryptedTitle) : (raw.title ?? ""),
          open(raw.encryptedContent),
          raw.encryptedLinks
            ? open(raw.encryptedLinks).then(parseLinks)
            : Promise.resolve([]),
          raw.encryptedMeta
            ? open(raw.encryptedMeta).then(parseItemMeta)
            : Promise.resolve(undefined),
        ]);
        if (!alive) return;
        setOpened({
          title,
          note,
          links,
          category: meta?.category ?? raw.category ?? "other",
          icon: meta?.icon,
          key,
          legacy,
        });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [raw, masterKey, itemKey, decryptContent, decryptContentWithKey]);

  const files = useOpenedFiles(
    rawFiles,
    opened ? (opened.legacy ? undefined : opened.key) : null,
  );

  return { raw, opened, files, failed };
}

/** The list-style summary of an opened item (labels, access, detail). */
export function summaryOf(
  raw: Doc<"vault_items">,
  opened: OpenedItem,
  files: OpenedFile[],
): VaultItemSummary {
  return {
    id: raw._id,
    title: opened.title,
    category: opened.category,
    kind: contentKind(files),
    files,
    folderId: raw.folderId,
    sharing: {
      accessLevel: raw.accessLevel,
      recipientMode: raw.recipientMode ?? "default",
      contacts: raw.sharedWithContacts,
      groups: raw.sharedWithGroups ?? [],
    },
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
