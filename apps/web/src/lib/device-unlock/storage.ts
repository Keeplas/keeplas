import { DeviceUnlockEntry, DeviceUnlockError } from "./types";

const DB_NAME = "keeplas-device-unlock";
// v2: entries are keyed by userId (phone-only accounts have no email). The v1
// email index stays so existing entries can be migrated on first read.
const DB_VERSION = 2;
const STORE = "entries";
const BY_USER_ID = "by_user_id";
const BY_LEGACY_EMAIL = "by_user";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new DeviceUnlockError("IndexedDB not available", "unsupported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.objectStoreNames.contains(STORE)
        ? req.transaction!.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: "id" });
      if (!store.indexNames.contains(BY_LEGACY_EMAIL)) {
        store.createIndex(BY_LEGACY_EMAIL, "userEmail", { unique: false });
      }
      if (!store.indexNames.contains(BY_USER_ID)) {
        store.createIndex(BY_USER_ID, "userId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new DeviceUnlockError("Failed to open device-unlock DB", "io", {
          cause: req.error,
        }),
      );
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let result: T | undefined;
        Promise.resolve(fn(store))
          .then((r) => {
            if (r && (r as IDBRequest).readyState !== undefined) {
              const req = r as IDBRequest<T>;
              req.onsuccess = () => {
                result = req.result;
              };
              req.onerror = () =>
                reject(
                  new DeviceUnlockError("DB op failed", "io", {
                    cause: req.error,
                  }),
                );
            } else {
              result = r as T;
            }
          })
          .catch(reject);
        transaction.oncomplete = () => resolve(result as T);
        transaction.onerror = () =>
          reject(
            new DeviceUnlockError("DB tx failed", "io", {
              cause: transaction.error,
            }),
          );
      }),
  );
}

function listByIndex(index: string, key: string): Promise<DeviceUnlockEntry[]> {
  return tx(
    "readonly",
    (store) =>
      store.index(index).getAll(key) as IDBRequest<DeviceUnlockEntry[]>,
  );
}

/**
 * Entries of `userId`. Entries written before v2 carry only the account email:
 * when `legacyEmail` is given they are re-keyed to `userId` once, here.
 */
export async function listEntriesForUser(
  userId: string,
  legacyEmail?: string,
): Promise<DeviceUnlockEntry[]> {
  const own = await listByIndex(BY_USER_ID, userId);
  if (!legacyEmail) return own;
  const legacy = (await listByIndex(BY_LEGACY_EMAIL, legacyEmail)).filter(
    (entry) => !entry.userId,
  );
  const migrated = legacy.map((entry) => ({
    ...entry,
    userId,
    userEmail: undefined,
  }));
  await Promise.all(migrated.map(putEntry));
  return [...own, ...migrated];
}

export async function getEntry(id: string): Promise<DeviceUnlockEntry | null> {
  const result = await tx("readonly", (store) => store.get(id));
  return (result as DeviceUnlockEntry | undefined) ?? null;
}

export async function putEntry(entry: DeviceUnlockEntry): Promise<void> {
  await tx("readwrite", (store) => store.put(entry));
}

export async function deleteEntry(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}
