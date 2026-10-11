import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";

import { decryptText } from "@/crypto/envelope";
import { INBOX, parseItemMeta, type VaultCategory } from "@/crypto/item-meta";
import {
  loadOwnerKeys,
  unwrapOwnerDek,
  type OwnerKeys,
} from "@/crypto/owner-keys";
import { useOutbox } from "@/features/outbox/outbox-provider";
import type { OutboxEntry } from "@/features/outbox/outbox";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

export interface VaultItemSummary {
  id: Id<"vault_items">;
  /** null when the item cannot be decrypted on this phone. */
  title: string | null;
  category: VaultCategory;
  folderId?: Id<"folders">;
  createdAt: number;
  updatedAt: number;
}

export interface FolderSummary {
  id: Id<"folders">;
  name: string | null;
  itemCount: number;
  grants: {
    grantId: Id<"folder_grants">;
    contactId: Id<"trusted_contacts">;
    contactName: string;
    timing: "now" | "after_verification";
  }[];
}

export interface PendingSummary {
  entry: OutboxEntry;
  title: string | null;
}

interface VaultDataValue {
  items: VaultItemSummary[] | undefined;
  folders: FolderSummary[] | undefined;
  /** Captures still on this phone (outbox), newest first. */
  pending: PendingSummary[];
  ownerKeys: () => Promise<OwnerKeys>;
  /** The key that opens an item: its DEK, or the MasterKey (legacy rows). */
  itemKey: (item: { ownerWrappedDek?: string }) => Promise<CryptoKey>;
}

const VaultDataContext = createContext<VaultDataValue | null>(null);

type ItemDoc = Doc<"vault_items">;

/**
 * Decrypted view of the vault for the unlocked app (M08-5 tiles and
 * recents, lists, search). Titles and categories are sealed (F4), so they
 * are opened here, once per item version, and held in memory only while the
 * unlocked app is mounted.
 */
export function VaultDataProvider({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const { masterKey } = useVault();
  const { entries } = useOutbox();
  const rawItems = useQuery(api.vault_items.getItems);
  const rawFolders = useQuery(api.folders.list);
  const cache = useRef(new Map<string, Promise<VaultItemSummary>>());
  const [items, setItems] = useState<VaultItemSummary[]>();
  const [folders, setFolders] = useState<FolderSummary[]>();
  const [pending, setPending] = useState<PendingSummary[]>([]);

  const ownerKeys = useCallback(() => {
    if (!masterKey) return Promise.reject(new Error("Vault is locked"));
    return loadOwnerKeys(viewer, masterKey);
  }, [viewer, masterKey]);

  const itemKey = useCallback(
    async (item: { ownerWrappedDek?: string }) => {
      if (!masterKey) throw new Error("Vault is locked");
      return item.ownerWrappedDek
        ? unwrapOwnerDek(item.ownerWrappedDek, await ownerKeys())
        : masterKey;
    },
    [masterKey, ownerKeys],
  );

  const summarize = useCallback(
    async (item: ItemDoc): Promise<VaultItemSummary> => {
      const base = {
        id: item._id,
        folderId: item.folderId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      try {
        const key = await itemKey(item);
        const title = item.encryptedTitle
          ? await decryptText(item.encryptedTitle, key)
          : (item.title ?? "");
        const category = item.encryptedMeta
          ? parseItemMeta(await decryptText(item.encryptedMeta, key)).category
          : (item.category ?? "other");
        return { ...base, title, category };
      } catch {
        return { ...base, title: null, category: item.category ?? "other" };
      }
    },
    [itemKey],
  );

  useEffect(() => {
    if (!rawItems) return;
    let alive = true;
    Promise.all(
      rawItems.map((item) => {
        const key = `${item._id}:${item.updatedAt}`;
        let summary = cache.current.get(key);
        if (!summary) {
          summary = summarize(item);
          cache.current.set(key, summary);
        }
        return summary;
      }),
    ).then((out) => {
      if (alive) setItems(out.sort((a, b) => b.updatedAt - a.updatedAt));
    });
    return () => {
      alive = false;
    };
  }, [rawItems, summarize]);

  useEffect(() => {
    if (!rawFolders || !masterKey) return;
    let alive = true;
    Promise.all(
      rawFolders.map(async (folder) => ({
        id: folder._id,
        name: await decryptText(folder.encryptedName, masterKey).catch(
          () => null,
        ),
        itemCount: folder.itemCount,
        grants: folder.grants,
      })),
    ).then((out) => alive && setFolders(out));
    return () => {
      alive = false;
    };
  }, [rawFolders, masterKey]);

  useEffect(() => {
    let alive = true;
    Promise.all(
      entries.map(async (entry) => ({
        entry,
        title: await itemKey(entry.item)
          .then((key) => decryptText(entry.item.encryptedTitle, key))
          .catch(() => null),
      })),
    ).then((out) => {
      if (alive)
        setPending(out.sort((a, b) => b.entry.createdAt - a.entry.createdAt));
    });
    return () => {
      alive = false;
    };
  }, [entries, itemKey]);

  const value = useMemo<VaultDataValue>(
    () => ({ items, folders, pending, ownerKeys, itemKey }),
    [items, folders, pending, ownerKeys, itemKey],
  );
  return (
    <VaultDataContext.Provider value={value}>
      {children}
    </VaultDataContext.Provider>
  );
}

export function useVaultData(): VaultDataValue {
  const value = useContext(VaultDataContext);
  if (!value) {
    throw new Error("useVaultData must be used inside VaultDataProvider");
  }
  return value;
}

/** Per-category counts (inbox apart) for the Home tiles. */
export function categoryCounts(
  items: VaultItemSummary[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

export const isInbox = (item: { category: VaultCategory }) =>
  item.category === INBOX;
