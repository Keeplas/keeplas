"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  persistMasterKey,
  loadMasterKey,
  clearPersistedMasterKeys,
} from "./master-key-store";
import { clearInMemorySecrets } from "./in-memory-secrets";
import { useIdleTimer } from "./use-idle-timer";

interface MasterKeyContextValue {
  masterKey: CryptoKey | null;
  setMasterKey: (key: CryptoKey) => void;
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
    (key: CryptoKey) => {
      setMasterKeyState(key);
      if (userId) {
        // Best-effort: a persistence failure must never block unlocking.
        void persistMasterKey(userId, key);
      }
    },
    [userId],
  );

  // Lock the vault: wipe the in-memory MasterKey, the persisted copy + device
  // shard (clearPersistedMasterKeys chokepoint), AND the cached decrypted owner
  // secret keys (ML-KEM + ML-DSA identity). Used for explicit clears, sign-out,
  // and the inactivity auto-lock below. Leaving masterKey null re-shows the
  // UnlockGate, forcing a re-unlock.
  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
    clearInMemorySecrets();
    void clearPersistedMasterKeys();
  }, []);

  // Inactivity auto-lock: bounds how long the extractable, persisted MasterKey
  // sits available on this device (defense-in-depth — the key stays extractable
  // + persisted by design so sharding/rotation can export it). Only armed while
  // the vault is actually unlocked; genuine activity resets the countdown.
  useIdleTimer({ onIdle: clearMasterKey, enabled: masterKey !== null });

  // The vault is "restoring" while auth/viewer are resolving, or while we still
  // have a persisted key to read for the current user. Derived (not stored) so
  // the restore effect only needs to setState from its async callback.
  const restoring =
    isLoading ||
    (isAuthenticated && user === undefined) ||
    (isAuthenticated && !!userId && !masterKey && restoredUserId !== userId);

  // Restore the persisted MasterKey on load so a refresh (or a browser restart)
  // does not force the user to re-enter their 24 words. The key is stored only
  // on this device (IndexedDB, never sent to the server) and stays until an
  // explicit sign-out clears it below.
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
