"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useConvexAuth } from "convex/react";

interface MasterKeyContextValue {
  masterKey: CryptoKey | null;
  setMasterKey: (key: CryptoKey) => void;
  clearMasterKey: () => void;
  hasMasterKey: boolean;
}

const MasterKeyContext = createContext<MasterKeyContextValue>({
  masterKey: null,
  setMasterKey: () => {},
  clearMasterKey: () => {},
  hasMasterKey: false,
});

export function MasterKeyProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKeyState] = useState<CryptoKey | null>(null);
  const { isAuthenticated, isLoading } = useConvexAuth();

  const setMasterKey = useCallback((key: CryptoKey) => {
    setMasterKeyState(key);
  }, []);

  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
  }, []);

  // Drop the in-memory master key as soon as the Convex session is no longer
  // authenticated (sign-out, token expiry, account switch on the same tab).
  // Without this, the next user landing in the same React tree could observe
  // the previous user's unwrapped key. setState-in-effect is intentional: we
  // are synchronising local secret state with an external auth subscription,
  // and the security invariant outweighs the cascading-render concern.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && masterKey !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMasterKeyState(null);
    }
  }, [isAuthenticated, isLoading, masterKey]);

  return (
    <MasterKeyContext.Provider
      value={{
        masterKey,
        setMasterKey,
        clearMasterKey,
        hasMasterKey: masterKey !== null,
      }}
    >
      {children}
    </MasterKeyContext.Provider>
  );
}

export function useMasterKey() {
  return useContext(MasterKeyContext);
}
