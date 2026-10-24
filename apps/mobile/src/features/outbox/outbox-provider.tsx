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
import { useNetworkState } from "expo-network";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import { uint8ToHex } from "@keeplas/crypto/encoding";

import { randomBytes } from "@/crypto/envelope";
import { sealCapture, type CaptureDraft } from "@/features/capture/seal";
import {
  createSink,
  deleteFile,
  openSource,
  outboxFile,
  uploadFile,
} from "@/lib/files";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useSession } from "@/providers/session-provider";
import {
  pendingEntries,
  requeue,
  uploadEntry,
  type OutboxDeps,
  type OutboxEntry,
  type Progress,
} from "./outbox";
import { sqliteStore } from "./sqlite-store";

interface OutboxValue {
  entries: OutboxEntry[];
  progress: Record<string, Progress>;
  online: boolean;
  /** Entry id → vault item id, once uploaded (M07-4 → M07-5). */
  created: Record<string, string>;
  /** Encrypt a capture on the phone and queue it; returns the entry id. */
  capture: (draft: CaptureDraft) => Promise<string>;
  /** "Tap to retry": failed entries go back to the queue. */
  retry: () => void;
}

const OutboxContext = createContext<OutboxValue | null>(null);

/**
 * Keeps the outbox moving: uploads waiting entries whenever the phone is
 * online and signed in, and requeues failed ones when the connection comes
 * back. Uploading needs no vault key (entries are sealed), so it continues
 * while the vault is locked.
 */
export function OutboxProvider({ children }: { children: ReactNode }) {
  const { viewer } = useSession();
  const network = useNetworkState();
  const online =
    network.isConnected !== false && network.isInternetReachable !== false;
  const userId = viewer?.encryptedKeyBundle ? viewer._id : null;

  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const generateUploadUrl = useAuditedMutation(
    api.vault_items.generateUploadUrl,
  );
  const createItem = useAuditedMutation(api.vault_items.createItem);
  const addItemFiles = useAuditedMutation(api.vault_items.addItemFiles);

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [created, setCreated] = useState<Record<string, string>>({});
  const flushing = useRef(false);
  const again = useRef(false);
  const lastPct = useRef<Record<string, number>>({});

  // Native upload events fire many times per second; a context update per
  // event re-renders every useOutbox consumer. Only publish whole-percent
  // changes.
  const reportProgress = useCallback((id: string, p: Progress) => {
    const pct = p.total > 0 ? Math.floor((100 * p.sent) / p.total) : 0;
    if (lastPct.current[id] === pct) return;
    lastPct.current[id] = pct;
    setProgress((all) => ({ ...all, [id]: p }));
  }, []);

  const reload = useCallback(async () => {
    setEntries(userId ? await sqliteStore.list(userId) : []);
  }, [userId]);

  const deps = useMemo<OutboxDeps>(
    () => ({
      vaultId: () => getOrCreateVault(),
      generateUploadUrl: () => generateUploadUrl() as Promise<string>,
      upload: uploadFile,
      createItem: async ({ vaultId, files, ...item }) =>
        (await createItem({
          ...item,
          captureHandoffId: item.captureHandoffId as
            Id<"capture_handoffs"> | undefined,
          recipientKeys: item.recipientKeys?.map((key) => ({
            contactId: key.contactId as Id<"trusted_contacts">,
            wrappedDek: key.wrappedDek,
          })),
          pendingRecipients: item.pendingRecipients?.map(
            (id) => id as Id<"trusted_contacts">,
          ),
          vaultId: vaultId as Id<"vaults">,
          files: files.map((f) => ({
            ...f,
            storageId: f.storageId as StorageRef,
          })),
        })) as string,
      addItemFiles: async (itemId, files) => {
        await addItemFiles({
          itemId: itemId as Id<"vault_items">,
          files: files.map((f) => ({
            ...f,
            storageId: f.storageId as StorageRef,
          })),
        });
      },
      deleteLocalFile: deleteFile,
    }),
    [getOrCreateVault, generateUploadUrl, createItem, addItemFiles],
  );

  const flush = useCallback(async () => {
    if (!userId || !online) return;
    if (flushing.current) {
      again.current = true;
      return;
    }
    flushing.current = true;
    try {
      do {
        again.current = false;
        for (const entry of pendingEntries(await sqliteStore.list(userId))) {
          try {
            const itemId = await uploadEntry(entry, sqliteStore, deps, (p) =>
              reportProgress(entry.id, p),
            );
            setCreated((all) => ({ ...all, [entry.id]: itemId }));
          } catch {
            // Kept as failed / quota; the list shows it.
          }
          await reload();
        }
      } while (again.current);
    } finally {
      flushing.current = false;
      await reload();
    }
  }, [userId, online, deps, reload, reportProgress]);

  const retry = useCallback(() => {
    if (!userId) return;
    void (async () => {
      for (const entry of requeue(await sqliteStore.list(userId))) {
        await sqliteStore.put(entry);
      }
      await reload();
      await flush();
    })();
  }, [userId, reload, flush]);

  // Load on sign-in; requeue and upload whenever the phone is (back) online.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    sqliteStore.list(userId).then((list) => alive && setEntries(list));
    return () => {
      alive = false;
    };
  }, [userId]);
  useEffect(() => {
    if (online) retry();
  }, [online, retry]);

  const ownerPublicKey = viewer?.publicKey;
  const capture = useCallback(
    async (draft: CaptureDraft) => {
      if (!userId || !ownerPublicKey) {
        throw new Error("Vault keys are not ready");
      }
      const id = uint8ToHex(randomBytes(16));
      const sealed = await sealCapture(id, draft, ownerPublicKey, {
        open: openSource,
        create: (entryId, index) => createSink(outboxFile(entryId, index)),
      });
      await sqliteStore.put({
        id,
        userId,
        createdAt: Date.now(),
        status: "waiting",
        attempts: 0,
        ...sealed,
      });
      await reload();
      void flush();
      return id;
    },
    [userId, ownerPublicKey, reload, flush],
  );

  const value = useMemo<OutboxValue>(
    () => ({ entries, progress, online, created, capture, retry }),
    [entries, progress, online, created, capture, retry],
  );
  return (
    <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
  );
}

export function useOutbox(): OutboxValue {
  const value = useContext(OutboxContext);
  if (!value) throw new Error("useOutbox must be used inside OutboxProvider");
  return value;
}
