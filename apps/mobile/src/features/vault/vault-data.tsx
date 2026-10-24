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
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { decryptText } from "@/crypto/envelope";
import {
  legacyFileMeta,
  parseFileMeta,
  parseItemMeta,
  type VaultCategory,
} from "@/crypto/item-meta";
import {
  loadOwnerKeys,
  unwrapOwnerDek,
  type OwnerKeys,
} from "@/crypto/owner-keys";
import { isIconName, type IconName } from "@/components/icon";
import { contentKind, type ContentKind } from "@/features/home/vault-groups";
import { useOutbox } from "@/features/outbox/outbox-provider";
import type { OutboxEntry } from "@/features/outbox/outbox";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import { loadItemSummaries, saveItemSummaries } from "./summary-cache";

export interface VaultItemSummary {
  id: Id<"vault_items">;
  /** null when the item cannot be decrypted on this phone. */
  title: string | null;
  category: VaultCategory;
  categoryId?: string;
  kind: ContentKind;
  icon?: IconName;
  attachments: number;
  durationSec?: number;
  folderId?: Id<"folders">;
  sharedWith: Id<"trusted_contacts">[];
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

export interface CategorySummary {
  id: Id<"vault_categories">;
  name: string | null;
}

export interface PendingSummary {
  entry: OutboxEntry;
  title: string | null;
}

interface VaultDataValue {
  items: VaultItemSummary[] | undefined;
  folders: FolderSummary[] | undefined;
  /** User-made categories (the built-in ones are fixed). */
  categories: CategorySummary[] | undefined;
  /** Captures still on this phone (outbox), newest first. */
  pending: PendingSummary[];
  ownerKeys: () => Promise<OwnerKeys>;
  /** The key that opens an item: its DEK, or the MasterKey (legacy rows). */
  itemKey: (item: { ownerWrappedDek?: string }) => Promise<CryptoKey>;
  summarize: (item: ItemDoc) => Promise<VaultItemSummary>;
}

const VaultDataContext = createContext<VaultDataValue | null>(null);

type ItemDoc = FunctionReturnType<
  typeof api.vault_items.getItemSummaries
>[number];

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
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const rawFolders = useQuery(api.folders.list);
  const rawCategories = useQuery(api.vault_categories.list);
  const cache = useRef(new Map<string, Promise<VaultItemSummary>>());
  // ML-KEM decapsulation is the expensive step of opening an item; keep the
  // unwrapped DEKs for the unlocked session (same exposure as the cached
  // titles and the ML-KEM secret key itself). Cleared on lock.
  const dekCache = useRef(new Map<string, Promise<CryptoKey>>());
  const pendingCache = useRef(new Map<string, Promise<string | null>>());
  const [items, setItems] = useState<VaultItemSummary[]>();
  const [folders, setFolders] = useState<FolderSummary[]>();
  const [categories, setCategories] = useState<CategorySummary[]>();
  const [pending, setPending] = useState<PendingSummary[]>([]);

  useEffect(() => {
    if (masterKey) return;
    cache.current.clear();
    dekCache.current.clear();
    pendingCache.current.clear();
  }, [masterKey]);

  const ownerKeys = useCallback(() => {
    if (!masterKey) return Promise.reject(new Error("Vault is locked"));
    return loadOwnerKeys(viewer, masterKey);
  }, [viewer, masterKey]);

  const itemKey = useCallback(
    async (item: { ownerWrappedDek?: string }) => {
      if (!masterKey) throw new Error("Vault is locked");
      const wrapped = item.ownerWrappedDek;
      if (!wrapped) return masterKey;
      let dek = dekCache.current.get(wrapped);
      if (!dek) {
        dek = ownerKeys().then((keys) => unwrapOwnerDek(wrapped, keys));
        dekCache.current.set(wrapped, dek);
        // Do not cache failures (e.g. a rotation racing the unwrap).
        dek.catch(() => dekCache.current.delete(wrapped));
      }
      return dek;
    },
    [masterKey, ownerKeys],
  );

  const summarize = useCallback(
    async (item: ItemDoc): Promise<VaultItemSummary> => {
      const base = {
        id: item._id,
        folderId: item.folderId,
        sharedWith: item.sharedWithContacts,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      try {
        const key = await itemKey(item);
        const title = item.encryptedTitle
          ? await decryptText(item.encryptedTitle, key)
          : (item.title ?? "");
        const meta = item.encryptedMeta
          ? parseItemMeta(await decryptText(item.encryptedMeta, key))
          : undefined;
        const category = meta?.category ?? item.category ?? "other";
        const icon =
          meta?.icon && isIconName(meta.icon) ? meta.icon : undefined;
        const files = await Promise.all(
          item.files.map(async (file) =>
            file.encryptedMeta
              ? parseFileMeta(await decryptText(file.encryptedMeta, key))
              : legacyFileMeta(file),
          ),
        );
        return {
          ...base,
          title,
          category,
          categoryId: meta?.categoryId,
          icon,
          kind: contentKind(files),
          attachments: files.length,
          durationSec: files.length === 1 ? files[0].durationSec : undefined,
        };
      } catch {
        return {
          ...base,
          title: null,
          category: item.category ?? "other",
          kind: "notes",
          attachments: item.files.length,
        };
      }
    },
    [itemKey],
  );

  // Seed from the on-device summary cache: the vault shows instantly (and
  // offline), and unchanged items skip their ML-KEM decapsulation below.
  useEffect(() => {
    if (!masterKey) return;
    let alive = true;
    loadItemSummaries(viewer._id).then((cached) => {
      if (!alive || cached.length === 0) return;
      for (const summary of cached) {
        const key = `${summary.id}:${summary.updatedAt}`;
        if (!cache.current.has(key)) {
          cache.current.set(key, Promise.resolve(summary));
        }
      }
      setItems((current) => current ?? cached);
    });
    return () => {
      alive = false;
    };
  }, [viewer._id, masterKey]);

  // Open items newest-first in small batches, yielding a macrotask between
  // batches that did real decryption work. Each ML-KEM decapsulation blocks
  // the JS thread, so opening the whole vault at once froze the UI for
  // seconds on low-end phones; batching keeps it responsive and shows the
  // most recent titles immediately.
  useEffect(() => {
    if (!rawItems) return;
    let alive = true;
    const sorted = [...rawItems].sort((a, b) => b.updatedAt - a.updatedAt);
    const BATCH = 8;
    void (async () => {
      const out: VaultItemSummary[] = [];
      for (let i = 0; i < sorted.length; i += BATCH) {
        let cached = true;
        const summaries = await Promise.all(
          sorted.slice(i, i + BATCH).map((item) => {
            const key = `${item._id}:${item.updatedAt}`;
            let summary = cache.current.get(key);
            if (!summary) {
              cached = false;
              summary = summarize(item);
              cache.current.set(key, summary);
            }
            return summary;
          }),
        );
        if (!alive) return;
        out.push(...summaries);
        if (!cached) {
          setItems(out.slice());
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!alive) return;
        }
      }
      setItems(out);
      void saveItemSummaries(viewer._id, out).catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [rawItems, summarize, viewer._id]);

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
    if (!rawCategories || !masterKey) return;
    let alive = true;
    Promise.all(
      rawCategories.map(async (category) => ({
        id: category._id,
        name: await decryptText(category.encryptedName, masterKey).catch(
          () => null,
        ),
      })),
    ).then((out) => alive && setCategories(out));
    return () => {
      alive = false;
    };
  }, [rawCategories, masterKey]);

  // Outbox entries reload after every upload step; cache their decrypted
  // titles so a flush does not redo one ML-KEM unwrap per entry each time.
  useEffect(() => {
    let alive = true;
    Promise.all(
      entries.map(async (entry) => {
        let title = pendingCache.current.get(entry.id);
        if (!title) {
          title = itemKey(entry.item)
            .then((key) => decryptText(entry.item.encryptedTitle, key))
            .catch(() => null);
          pendingCache.current.set(entry.id, title);
        }
        return { entry, title: await title };
      }),
    ).then((out) => {
      if (alive)
        setPending(out.sort((a, b) => b.entry.createdAt - a.entry.createdAt));
    });
    return () => {
      alive = false;
    };
  }, [entries, itemKey]);

  const value = useMemo<VaultDataValue>(
    () => ({
      items,
      folders,
      categories,
      pending,
      ownerKeys,
      itemKey,
      summarize,
    }),
    [items, folders, categories, pending, ownerKeys, itemKey, summarize],
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
