import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, View } from "react-native";

import { importMasterKey } from "@/crypto/vault-keys";
import { openDeviceVault, unlockDeviceVault } from "@/crypto/device-vault";
import { forgetOwnerKeys } from "@/crypto/owner-keys";
import {
  IDLE_LOCK_MS,
  instantNow,
  isLockHeld,
  shouldLockOnResume,
  type Instant,
} from "@/lib/auto-lock";
import { clearDecryptedCache } from "@/lib/files";

interface VaultValue {
  /** Live MasterKey while unlocked; null when locked. */
  masterKey: CryptoKey | null;
  /**
   * Biometric unlock (M08-6). Resolves to the RootKey when this phone knows
   * it (the caller wipes it), so the cloud backup needs no second prompt.
   */
  unlock: (
    userId: string,
    prompt: string,
    pin?: string,
  ) => Promise<Uint8Array | null>;
  /** Biometric step-up without changing state (M03-5 Approve). */
  confirmPresence: (
    userId: string,
    prompt: string,
    pin?: string,
  ) => Promise<void>;
  /** Keep a MasterKey obtained by creation or the recovery kit (wiped). */
  adopt: (rawMasterKey: Uint8Array) => Promise<CryptoKey>;
  lock: () => void;
  exportRawMasterKey: () => Promise<Uint8Array>;
  /** The vault exists but the setup screens (contacts, done) are still open. */
  finishingSetup: boolean;
  setFinishingSetup: (finishing: boolean) => void;
}

const VaultContext = createContext<VaultValue | null>(null);

/**
 * Holds the unlocked vault key in memory and locks it after 5 minutes idle
 * or 30 s in the background. Locking drops every in-memory secret.
 */
export function VaultProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [finishingSetup, setFinishingSetup] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundedAt = useRef<Instant | null>(null);
  const backgroundHeld = useRef(false);

  const lock = useCallback(() => {
    setMasterKey(null);
    forgetOwnerKeys();
    clearDecryptedCache();
  }, []);

  const adopt = useCallback(async (raw: Uint8Array) => {
    const key = await importMasterKey(raw);
    setMasterKey(key);
    raw.fill(0);
    return key;
  }, []);

  const unlock = useCallback(
    async (userId: string, prompt: string, pin?: string) => {
      const { masterKey, rootKey } = await openDeviceVault(userId, prompt, pin);
      await adopt(masterKey);
      return rootKey;
    },
    [adopt],
  );

  const confirmPresence = useCallback(
    async (userId: string, prompt: string, pin?: string) => {
      (await unlockDeviceVault(userId, prompt, pin)).fill(0);
    },
    [],
  );

  const exportRawMasterKey = useCallback(async () => {
    if (!masterKey) throw new Error("Vault is locked");
    return new Uint8Array(await crypto.subtle.exportKey("raw", masterKey));
  }, [masterKey]);

  const armIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const fire = () => {
      if (isLockHeld()) idleTimer.current = setTimeout(fire, IDLE_LOCK_MS);
      else lock();
    };
    idleTimer.current = setTimeout(fire, IDLE_LOCK_MS);
  }, [lock]);

  useEffect(() => {
    if (!masterKey) return;
    armIdleTimer();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const held = backgroundHeld.current || isLockHeld();
        if (shouldLockOnResume(backgroundedAt.current, instantNow(), held)) {
          lock();
        }
        backgroundedAt.current = null;
        backgroundHeld.current = false;
      } else {
        backgroundedAt.current ??= instantNow();
        backgroundHeld.current ||= isLockHeld();
      }
    });
    return () => {
      subscription.remove();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [masterKey, armIdleTimer, lock]);

  const value = useMemo<VaultValue>(
    () => ({
      masterKey,
      unlock,
      confirmPresence,
      adopt,
      lock,
      exportRawMasterKey,
      finishingSetup,
      setFinishingSetup,
    }),
    [
      masterKey,
      unlock,
      confirmPresence,
      adopt,
      lock,
      exportRawMasterKey,
      finishingSetup,
    ],
  );

  return (
    <VaultContext.Provider value={value}>
      {/* Any touch counts as activity for the idle lock. */}
      <View
        style={{ flex: 1 }}
        onTouchStart={masterKey ? armIdleTimer : undefined}
      >
        {children}
      </View>
    </VaultContext.Provider>
  );
}

export function useVault(): VaultValue {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used inside VaultProvider");
  return value;
}
