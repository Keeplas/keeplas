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
import { contentKind } from "@keeplas/backend/lib/vault_groups";
import { legacyFileMeta, parseFileMeta, parseItemMeta } from "./item-meta";
import { useMasterKey } from "./master-key-context";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useVaultCrypto } from "./use-vault-crypto";
import type { VaultItemSummary } from "./vault-list";

/** A custom category (stored as a folder). */
export interface FolderSummary {
  id: Id<"folders">;
  /** null when the name cannot be decrypted in this browser. */
  name: string | null;
  itemCount: number;
}

type ItemDoc = FunctionReturnType<
  typeof api.vault_items.getItemSummaries
>[number];

interface VaultDataValue {
  items: VaultItemSummary[] | undefined;
  folders: FolderSummary[] | undefined;
  /** The key that opens an item: its DEK, or the master key (legacy rows). */
  itemKey: (item: { ownerWrappedDek?: string }) => Promise<CryptoKey>;
}

const VaultDataContext = createContext<VaultDataValue | null>(null);

// Opening an item costs one ML-KEM decapsulation. Items open newest first,
// a few at a time, yielding between batches so the page stays responsive.
const BATCH = 8;

/**
 * Decrypted view of the owner's vault for the signed-in web app (dashboard,
 * vault list, item screens). Titles, categories and file metadata are sealed
 * (F4): each item version is opened once and kept in memory while the vault
 * is unlocked; locking clears every cached key and value.
 */
export function VaultDataProvider({ children }: { children: ReactNode }) {
  const { masterKey } = useMasterKey();
  const { decryptContent, decryptContentWithKey } = useVaultCrypto();
  const { unwrapOwnerDek, isReady } = useRecipientCrypto();
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const rawFolders = useQuery(api.folders.list);
  const summaries = useRef(new Map<string, Promise<VaultItemSummary>>());
  const deks = useRef(new Map<string, Promise<CryptoKey>>());
  const [items, setItems] = useState<VaultItemSummary[]>();
  const [folders, setFolders] = useState<FolderSummary[]>();

  useEffect(() => {
    if (masterKey) return;
    summaries.current.clear();
    deks.current.clear();
  }, [masterKey]);

  const itemKey = useCallback(
    async (item: { ownerWrappedDek?: string }) => {
      if (!masterKey) throw new Error("Vault is locked");
      const wrapped = item.ownerWrappedDek;
      if (!wrapped) return masterKey;
      let dek = deks.current.get(wrapped);
      if (!dek) {
        dek = unwrapOwnerDek({ wrappedDek: wrapped });
        deks.current.set(wrapped, dek);
        // Do not cache failures (e.g. a key rotation racing the unwrap).
        dek.catch(() => deks.current.delete(wrapped));
      }
      return dek;
    },
    [masterKey, unwrapOwnerDek],
  );

  const summarize = useCallback(
    async (item: ItemDoc): Promise<VaultItemSummary> => {
      const base = {
        id: item._id,
        folderId: item.folderId,
        sharing: {
          accessLevel: item.accessLevel,
          recipientMode: item.recipientMode,
          contacts: item.sharedWithContacts,
          groups: item.sharedWithGroups,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      try {
        const key = await itemKey(item);
        const open = (payload: string) =>
          key === masterKey
            ? decryptContent(payload)
            : decryptContentWithKey(payload, key);
        const title = item.encryptedTitle
          ? await open(item.encryptedTitle)
          : (item.title ?? "");
        const meta = item.encryptedMeta
          ? parseItemMeta(await open(item.encryptedMeta))
          : undefined;
        const files = await Promise.all(
          item.files.map(async (file) =>
            file.encryptedMeta
              ? parseFileMeta(await open(file.encryptedMeta))
              : legacyFileMeta(file),
          ),
        );
        return {
          ...base,
          title,
          category: meta?.category ?? item.category ?? "other",
          icon: meta?.icon,
          kind: contentKind(files),
          files,
        };
      } catch {
        return {
          ...base,
          title: null,
          category: item.category ?? "other",
          kind: "notes",
          files: [],
        };
      }
    },
    [itemKey, masterKey, decryptContent, decryptContentWithKey],
  );

  useEffect(() => {
    if (!rawItems || !masterKey || !isReady) return;
    let alive = true;
    const sorted = [...rawItems].sort((a, b) => b.updatedAt - a.updatedAt);
    void (async () => {
      const out: VaultItemSummary[] = [];
      for (let i = 0; i < sorted.length; i += BATCH) {
        let cached = true;
        const batch = await Promise.all(
          sorted.slice(i, i + BATCH).map((item) => {
            const key = `${item._id}:${item.updatedAt}`;
            let summary = summaries.current.get(key);
            if (!summary) {
              cached = false;
              summary = summarize(item);
              summaries.current.set(key, summary);
            }
            return summary;
          }),
        );
        if (!alive) return;
        out.push(...batch);
        if (!cached) {
          setItems(out.slice());
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!alive) return;
        }
      }
      setItems(out);
    })();
    return () => {
      alive = false;
    };
  }, [rawItems, masterKey, isReady, summarize]);

  useEffect(() => {
    if (!rawFolders || !masterKey) return;
    let alive = true;
    Promise.all(
      rawFolders.map(async (folder) => ({
        id: folder._id,
        name: await decryptContent(folder.encryptedName).catch(() => null),
        itemCount: folder.itemCount,
      })),
    ).then((out) => alive && setFolders(out));
    return () => {
      alive = false;
    };
  }, [rawFolders, masterKey, decryptContent]);

  const value = useMemo<VaultDataValue>(
    () => ({ items, folders, itemKey }),
    [items, folders, itemKey],
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
