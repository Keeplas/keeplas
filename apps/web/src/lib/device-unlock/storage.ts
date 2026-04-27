import { DeviceUnlockEntry, DeviceUnlockError } from "./types";

const DB_NAME = "keeplas-device-unlock";
const DB_VERSION = 1;
const STORE = "entries";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new DeviceUnlockError("IndexedDB not available", "unsupported")
      );
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_user", "userEmail", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new DeviceUnlockError("Failed to open device-unlock DB", "io", {
          cause: req.error,
        })
      );
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
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
                reject(new DeviceUnlockError("DB op failed", "io", { cause: req.error }));
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
            })
          );
      })
  );
}

export async function listEntriesForUser(
  userEmail: string
): Promise<DeviceUnlockEntry[]> {
  return tx("readonly", (store) => {
    const idx = store.index("by_user");
    const req = idx.getAll(userEmail);
    return req as IDBRequest<DeviceUnlockEntry[]>;
  });
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

export async function deleteAllForUser(userEmail: string): Promise<void> {
  const entries = await listEntriesForUser(userEmail);
  await Promise.all(entries.map((e) => deleteEntry(e.id)));
}
