"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

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

  const setMasterKey = useCallback((key: CryptoKey) => {
    setMasterKeyState(key);
  }, []);

  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
  }, []);

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
