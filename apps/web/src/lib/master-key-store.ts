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
 *   It stays extractable because device unlock methods wrap its raw bytes
 *   (device-unlock/key-import.ts); a script running on this origin while unlocked could therefore
 *   read it. The trade-off is deliberate: the vault no longer re-locks on
 *   refresh. Cleared on sign-out via clearPersistedMasterKeys().
 * - The copy carries the time of the last user activity: one left idle for
 *   the auto-lock window is dropped on load, so closing the browser while
 *   unlocked does not escape the inactivity lock.
 */

import { purgeLegacyShards } from "./purge-legacy-shards";
import { AUTO_LOCK_TIMEOUT_MS } from "./use-idle-timer";

const DB_NAME = "keeplas-master-key";
// v2: keyed by userId instead of email. The MasterKey is identifier-agnostic
// (derived from the 24-word phrase, bound to the userId), and accounts can now
// carry both an email and a phone, so email is no longer a stable cache key.
const DB_VERSION = 2;
const STORE = "keys";

interface StoredMasterKey {
  userId: string;
  key: CryptoKey;
  /** Epoch ms after which the copy is dropped; unset keeps it until sign-out. */
  expiresAt?: number;
  /** Last user activity (epoch ms). Unset on copies saved before tracking. */
  lastActiveAt?: number;
}

/**
 * Whether a persisted copy must be dropped: past its link's lifetime, or idle
 * for the auto-lock window (the in-tab idle timer never fires once the
 * browser is closed). A copy saved before activity tracking is kept; its
 * first activity starts the clock.
 */
export function isPersistedKeyExpired(
  record: Pick<StoredMasterKey, "expiresAt" | "lastActiveAt">,
  now: number,
): boolean {
  if (record.expiresAt !== undefined && record.expiresAt <= now) return true;
  return (
    record.lastActiveAt !== undefined &&
    now - record.lastActiveAt >= AUTO_LOCK_TIMEOUT_MS
  );
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
 * Persist the MasterKey for a user, until `expiresAt` when given. Best-effort:
 * failures are logged and swallowed so they never block the unlock flow.
 */
export async function persistMasterKey(
  userId: string,
  key: CryptoKey,
  expiresAt?: number,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        userId,
        key,
        expiresAt,
        lastActiveAt: Date.now(),
      } satisfies StoredMasterKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to persist Master Key:", err);
  }
}

/**
 * Load the persisted MasterKey for a user, or null if none / expired / on
 * error. An expired copy is deleted.
 */
export async function loadMasterKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openDb();
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(userId);
      req.onsuccess = () => {
        const record = req.result as StoredMasterKey | undefined;
        if (record && isPersistedKeyExpired(record, Date.now())) {
          store.delete(userId);
          resolve(null);
          return;
        }
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
 * Record user activity on the persisted copy (best-effort, like persisting).
 * The caller throttles: this writes IndexedDB.
 */
export async function touchMasterKey(userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(userId);
      req.onsuccess = () => {
        const record = req.result as StoredMasterKey | undefined;
        if (record) store.put({ ...record, lastActiveAt: Date.now() });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to record Master Key activity:", err);
  }
}

/**
 * Wipe every persisted MasterKey. Called on sign-out / session loss so a
 * logged-out browser never keeps a usable key on disk. This is the single
 * chokepoint for clearing device-local crypto material, so it also removes any
 * legacy pre-v2 Shamir shard left in this browser.
 */
export async function clearPersistedMasterKeys(): Promise<void> {
  purgeLegacyShards();
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
