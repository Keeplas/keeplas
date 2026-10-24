/**
 * Offline capture outbox (M07-4, Offline_* states). A capture is encrypted
 * on the phone first (title, metadata, content and files under a fresh DEK
 * wrapped to the owner), so an entry holds only ciphertext: the ciphertext
 * files on disk and the `vault_items.createItem` arguments. Entries live in
 * SQLCipher (sqlite-store.ts) and are uploaded when the phone is online.
 *
 * Resumable: each uploaded file records its storageId before the next step,
 * so a crash or a lost connection never uploads a file twice.
 */

export type OutboxStatus = "waiting" | "uploading" | "failed" | "quota";

export interface OutboxFile {
  /** Ciphertext on this phone (file:// URI). */
  path: string;
  iv: string;
  encryptedMeta: string;
  /** Ciphertext size, for progress. */
  bytes: number;
  /** Convex storage id once uploaded. */
  storageId?: string;
}

/** The sealed item: exactly what `createItem` stores, already encrypted. */
export interface SealedItem {
  encryptedTitle: string;
  encryptedMeta: string;
  encryptedContent: string;
  ownerWrappedDek: string;
  /** "trusted_only" when shared with every trusted contact; else private. */
  accessLevel?: "private" | "trusted_only";
  /** "explicit" when shared with `sharedWithContacts` only. */
  recipientMode?: "default" | "explicit";
  sharedWithContacts?: string[];
  recipientKeys?: { contactId: string; wrappedDek: string }[];
  /** Contacts without a published key yet, re-wrapped by the owner later. */
  pendingRecipients?: string[];
  captureHandoffId?: string;
}

export interface OutboxEntry {
  id: string;
  userId: string;
  createdAt: number;
  item: SealedItem;
  files: OutboxFile[];
  attachTo?: string;
  status: OutboxStatus;
  attempts: number;
  error?: string;
}

export interface OutboxStore {
  list: (userId: string) => Promise<OutboxEntry[]>;
  put: (entry: OutboxEntry) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export interface CreateItemArgs extends SealedItem {
  vaultId: string;
  accessLevel: "private" | "trusted_only";
  encryptionType: "zero_knowledge";
  recipientMode: "default" | "explicit";
  files: { storageId: string; iv: string; encryptedMeta: string }[];
}

export interface OutboxDeps {
  vaultId: () => Promise<string>;
  generateUploadUrl: () => Promise<string>;
  /** POST the ciphertext file; returns the storage id. */
  upload: (
    url: string,
    path: string,
    onProgress: (sent: number) => void,
  ) => Promise<string>;
  createItem: (args: CreateItemArgs) => Promise<string>;
  addItemFiles: (
    itemId: string,
    files: CreateItemArgs["files"],
  ) => Promise<void>;
  deleteLocalFile: (path: string) => void;
}

export interface Progress {
  sent: number;
  total: number;
}

export const QUOTA_ERROR = "STORAGE_QUOTA_EXCEEDED";

export const totalBytes = (entry: OutboxEntry): number =>
  entry.files.reduce((sum, f) => sum + f.bytes, 0);

/**
 * Upload one entry: files first (each storageId persisted as soon as it is
 * known), then the item. Returns the new item id. On failure the entry is
 * kept as `failed` (or `quota` when the plan is full) and the error rethrown.
 */
export async function uploadEntry(
  entry: OutboxEntry,
  store: OutboxStore,
  deps: OutboxDeps,
  onProgress: (progress: Progress) => void = () => undefined,
): Promise<string> {
  const total = totalBytes(entry);
  let current: OutboxEntry = { ...entry, status: "uploading" };
  await store.put(current);
  try {
    let done = current.files
      .filter((f) => f.storageId)
      .reduce((sum, f) => sum + f.bytes, 0);
    onProgress({ sent: done, total });
    for (let i = 0; i < current.files.length; i++) {
      const file = current.files[i];
      if (file.storageId) continue;
      const storageId = await deps.upload(
        await deps.generateUploadUrl(),
        file.path,
        (sent) =>
          onProgress({ sent: done + Math.min(sent, file.bytes), total }),
      );
      done += file.bytes;
      const files = current.files.map((f, j) =>
        j === i ? { ...f, storageId } : f,
      );
      current = { ...current, files };
      await store.put(current);
    }
    const uploaded = current.files.map((f) => ({
      storageId: f.storageId!,
      iv: f.iv,
      encryptedMeta: f.encryptedMeta,
    }));
    let itemId: string;
    if (current.attachTo) {
      await deps.addItemFiles(current.attachTo, uploaded);
      itemId = current.attachTo;
    } else {
      itemId = await deps.createItem({
        vaultId: await deps.vaultId(),
        accessLevel: "private",
        recipientMode: "default",
        ...current.item,
        encryptionType: "zero_knowledge",
        files: uploaded,
      });
    }
    for (const file of current.files) deps.deleteLocalFile(file.path);
    await store.remove(current.id);
    onProgress({ sent: total, total });
    return itemId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.put({
      ...current,
      status: message.includes(QUOTA_ERROR) ? "quota" : "failed",
      attempts: current.attempts + 1,
      error: message,
    });
    throw error;
  }
}

/** Entries to send now: waiting ones, oldest first. */
export function pendingEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Back online or retry tapped: failed entries go back to waiting. Entries
 * stuck in `uploading` (the app was killed mid-upload) resume too. Quota
 * entries stay put until storage frees up or the plan changes.
 */
export function requeue(entries: OutboxEntry[]): OutboxEntry[] {
  return entries
    .filter((e) => e.status === "failed" || e.status === "uploading")
    .map((e) => ({ ...e, status: "waiting" as const }));
}

/** In-memory store (tests). */
export function memoryStore(): OutboxStore & {
  entries: Map<string, OutboxEntry>;
} {
  const entries = new Map<string, OutboxEntry>();
  return {
    entries,
    list: async (userId) =>
      [...entries.values()].filter((e) => e.userId === userId),
    put: async (entry) => {
      entries.set(entry.id, entry);
    },
    remove: async (id) => {
      entries.delete(id);
    },
  };
}
