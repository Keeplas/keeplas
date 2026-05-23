/**
 * Device-local persistence of the unwrapped MasterKey.
 *
 * The MasterKey is the AES-256 key that decrypts vault content. It is derived
 * client-side from the 24-word phrase (V2 bundle) and normally lives only in
 * memory (see master-key-context.tsx). Persisting it here lets the vault stay
 * unlocked across page refreshes and browser restarts until the user signs out
 * explicitly.
 *
 * Security:
 * - Stored only in IndexedDB on this device. Never sent to the server — the
 *   zero-knowledge model is preserved.
 * - The CryptoKey object itself is stored via structured clone (not raw bytes).
 *   It stays extractable because shard distribution (use-distribute-shards.ts)
 *   exports it; a script running on this origin while unlocked could therefore
 *   read it. The trade-off is deliberate: the vault no longer re-locks on
 *   refresh. Cleared on sign-out via clearPersistedMasterKeys().
 */

const DB_NAME = "keeplas-master-key";
// v2: keyed by userId instead of email. The MasterKey is identifier-agnostic
// (derived from the 24-word phrase, bound to the userId), and accounts can now
// carry both an email and a phone, so email is no longer a stable cache key.
const DB_VERSION = 2;
const STORE = "keys";

interface StoredMasterKey {
  userId: string;
  key: CryptoKey;
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
      // Drop the old email-keyed store; persisted keys can't be re-derived
      // without the phrase, so the only cost of the migration is one re-unlock.
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      db.createObjectStore(STORE, { keyPath: "userId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/**
 * Persist the MasterKey for a user. Best-effort: failures are logged and
 * swallowed so they never block the unlock flow.
 */
export async function persistMasterKey(
  userId: string,
  key: CryptoKey,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ userId, key } satisfies StoredMasterKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to persist Master Key:", err);
  }
}

/**
 * Load the persisted MasterKey for a user, or null if none / on error.
 */
export async function loadMasterKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openDb();
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(userId);
      req.onsuccess = () => {
        const record = req.result as StoredMasterKey | undefined;
        resolve(record?.key ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to load Master Key:", err);
    return null;
  }
}

/**
 * Wipe every persisted MasterKey. Called on sign-out / session loss so a
 * logged-out browser never keeps a usable key on disk.
 */
export async function clearPersistedMasterKeys(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to clear persisted Master Keys:", err);
  }
}
