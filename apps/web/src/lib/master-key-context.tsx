import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  persistMasterKey,
  loadMasterKey,
  clearPersistedMasterKeys,
  touchMasterKey,
} from "./master-key-store";
import { clearLegacyMethods } from "./device-unlock";
import { clearInMemorySecrets } from "./in-memory-secrets";
import { useIdleTimer } from "./use-idle-timer";

/**
 * How long a browser linked without "Keep me logged in" stays unlocked, across
 * refreshes, before it must be linked (or PIN-unlocked) again.
 */
const UNTRUSTED_LINK_TTL_MS = 60 * 60 * 1000;

/** Min gap between two writes of the last-activity time to IndexedDB. */
const ACTIVITY_PERSIST_INTERVAL_MS = 60 * 1000;

interface SetMasterKeyOptions {
  /**
   * Linked with "Keep me logged in": the IndexedDB copy stays until sign-out
   * (or the inactivity lock). Otherwise it is dropped after
   * UNTRUSTED_LINK_TTL_MS, whether the key came from the phone or a PIN.
   */
  trusted: boolean;
}

interface MasterKeyContextValue {
  masterKey: CryptoKey | null;
  setMasterKey: (key: CryptoKey, options: SetMasterKeyOptions) => void;
  clearMasterKey: () => void;
  hasMasterKey: boolean;
  /** True while attempting to restore a persisted key on load. */
  restoring: boolean;
}

const MasterKeyContext = createContext<MasterKeyContextValue>({
  masterKey: null,
  setMasterKey: () => {},
  clearMasterKey: () => {},
  hasMasterKey: false,
  restoring: true,
});

export function MasterKeyProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKeyState] = useState<CryptoKey | null>(null);
  // userId for which the IndexedDB restore attempt has finished. Lets us tell
  // "still reading the persisted key" apart from "read, nothing stored".
  const [restoredUserId, setRestoredUserId] = useState<string | null>(null);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.viewer);
  // Key the device cache by userId, not email: the MasterKey is identifier-
  // agnostic, and an account can carry both an email and a phone.
  const userId = user?._id ?? null;

  const setMasterKey = useCallback(
    (key: CryptoKey, { trusted }: SetMasterKeyOptions) => {
      setMasterKeyState(key);
      if (userId) {
        // Best-effort: a persistence failure must never block unlocking.
        void persistMasterKey(
          userId,
          key,
          trusted ? undefined : Date.now() + UNTRUSTED_LINK_TTL_MS,
        );
      }
    },
    [userId],
  );

  // Lock the vault: wipe the in-memory MasterKey, the persisted copy + any
  // legacy shard (clearPersistedMasterKeys chokepoint), AND the cached decrypted owner
  // secret keys (ML-KEM + ML-DSA identity). Used for explicit clears, sign-out,
  // and the inactivity auto-lock below. Leaving masterKey null re-shows the
  // UnlockGate, forcing a re-unlock.
  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
    clearInMemorySecrets();
    void clearPersistedMasterKeys();
  }, []);

  // Activity is also stamped on the persisted copy, so a browser closed while
  // unlocked comes back locked once the auto-lock window has passed.
  const lastActivityWrite = useRef(0);
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (!userId || now - lastActivityWrite.current < ACTIVITY_PERSIST_INTERVAL_MS)
      return;
    lastActivityWrite.current = now;
    void touchMasterKey(userId);
  }, [userId]);

  // Inactivity auto-lock: bounds how long the extractable, persisted MasterKey
  // sits available on this device (defense-in-depth — the key stays extractable
  // + persisted by design so rotation can export it). Only armed while
  // the vault is actually unlocked; genuine activity resets the countdown.
  useIdleTimer({
    onIdle: clearMasterKey,
    onActivity: recordActivity,
    enabled: masterKey !== null,
  });

  // The vault is "restoring" while auth/viewer are resolving, or while we still
  // have a persisted key to read for the current user. Derived (not stored) so
  // the restore effect only needs to setState from its async callback.
  const restoring =
    isLoading ||
    (isAuthenticated && user === undefined) ||
    (isAuthenticated && !!userId && !masterKey && restoredUserId !== userId);

  // Restore the persisted MasterKey on load so a refresh (or a browser restart)
  // does not force the user to unlock again. The key is stored only
  // on this device (IndexedDB, never sent to the server) and stays until an
  // explicit sign-out clears it below, its link lifetime ends, or it sat idle
  // for the auto-lock window (master-key-store.ts).
  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId || masterKey) return;
    if (restoredUserId === userId) return;
    let cancelled = false;
    loadMasterKey(userId).then((key) => {
      if (cancelled) return;
      if (key) setMasterKeyState(key);
      setRestoredUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, userId, masterKey, restoredUserId]);

  // Drop the in-memory master key AND wipe the persisted copy as soon as the
  // Convex session is no longer authenticated (sign-out, token expiry, account
  // switch on the same tab). Without this, the next user landing in the same
  // React tree — or anyone reopening this browser after sign-out — could read
  // the previous user's key. Persisting the key so refresh keeps the vault
  // unlocked is the deliberate counterpart to clearing it here on sign-out.
  // Legacy PIN-only wraps go too: a signed-out browser must keep nothing on
  // disk that a PIN search can open (server-assisted PINs end with the
  // session server-side).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (masterKey !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMasterKeyState(null);
      }
      if (restoredUserId !== null) {
        setRestoredUserId(null);
      }
      clearInMemorySecrets();
      void clearPersistedMasterKeys();
      void clearLegacyMethods().catch(() => {
        // No IndexedDB (private mode): nothing was stored.
      });
    }
  }, [isAuthenticated, isLoading, masterKey, restoredUserId]);

  return (
    <MasterKeyContext.Provider
      value={{
        masterKey,
        setMasterKey,
        clearMasterKey,
        hasMasterKey: masterKey !== null,
        restoring,
      }}
    >
      {children}
    </MasterKeyContext.Provider>
  );
}

export function useMasterKey() {
  return useContext(MasterKeyContext);
}
