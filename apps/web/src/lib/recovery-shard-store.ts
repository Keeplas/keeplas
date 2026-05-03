/**
 * IndexedDB store for raw Shamir shards held by a trust contact for the
 * vaults that designated them. Each entry is keyed by the vault owner's
 * userId — the contact never holds more than one shard per owner.
 *
 * Raw bytes only ever live on the contact's device. The server holds the
 * ML-KEM-wrapped envelope (`vault.encryptedShard`); the contact unwraps
 * once on /shared-with-me and persists the result here so subsequent
 * recovery submissions are an O(1) read.
 */

const DB_NAME = "keeplas-recovery-shards";
const DB_VERSION = 1;
const STORE = "shards";

export interface StoredShard {
  // Vault owner's user id — opaque string from Convex, used as the key.
  ownerUserId: string;
  // The Shamir share bytes (1 byte x-coordinate + N bytes payload).
  rawShard: Uint8Array;
  // Hash of the wrapped envelope we unwrapped, used to detect rewrites.
  envelopeHash: string;
  storedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "ownerUserId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("DB open failed"));
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | T
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let result: T | undefined;
        const r = fn(store);
        if (r && (r as IDBRequest).readyState !== undefined) {
          const req = r as IDBRequest<T>;
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () => reject(req.error);
        } else {
          result = r as T;
        }
        transaction.oncomplete = () => resolve(result as T);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export async function getStoredShard(
  ownerUserId: string
): Promise<StoredShard | null> {
  const result = await tx("readonly", (store) => store.get(ownerUserId));
  return (result as StoredShard | undefined) ?? null;
}

export async function putStoredShard(entry: StoredShard): Promise<void> {
  await tx("readwrite", (store) => store.put(entry));
}

export async function deleteStoredShard(ownerUserId: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(ownerUserId));
}

/**
 * Compute a stable short hash of an envelope string. SHA-256 → first 16
 * hex chars. Used to detect when the server-side envelope has been replaced
 * (re-distribution after threshold change) so the local raw shard is
 * refreshed automatically.
 */
export async function envelopeFingerprint(envelope: string): Promise<string> {
  const bytes = new TextEncoder().encode(envelope);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
