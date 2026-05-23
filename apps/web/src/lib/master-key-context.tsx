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
  // Email for which the IndexedDB restore attempt has finished. Lets us tell
  // "still reading the persisted key" apart from "read, nothing stored".
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.viewer);
  const userEmail = user?.email ?? null;

  const setMasterKey = useCallback(
    (key: CryptoKey) => {
      setMasterKeyState(key);
      if (userEmail) {
        // Best-effort: a persistence failure must never block unlocking.
        void persistMasterKey(userEmail, key);
      }
    },
    [userEmail],
  );

  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
    void clearPersistedMasterKeys();
  }, []);

  // The vault is "restoring" while auth/viewer are resolving, or while we still
  // have a persisted key to read for the current user. Derived (not stored) so
  // the restore effect only needs to setState from its async callback.
  const restoring =
    isLoading ||
    (isAuthenticated && user === undefined) ||
    (isAuthenticated &&
      !!userEmail &&
      !masterKey &&
      restoredEmail !== userEmail);

  // Restore the persisted MasterKey on load so a refresh (or a browser restart)
  // does not force the user to re-enter their 24 words. The key is stored only
  // on this device (IndexedDB, never sent to the server) and stays until an
  // explicit sign-out clears it below.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !userEmail || masterKey) return;
    if (restoredEmail === userEmail) return;
    let cancelled = false;
    loadMasterKey(userEmail).then((key) => {
      if (cancelled) return;
      if (key) setMasterKeyState(key);
      setRestoredEmail(userEmail);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, userEmail, masterKey, restoredEmail]);

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
      if (restoredEmail !== null) {
        setRestoredEmail(null);
      }
      void clearPersistedMasterKeys();
    }
  }, [isAuthenticated, isLoading, masterKey, restoredEmail]);

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
