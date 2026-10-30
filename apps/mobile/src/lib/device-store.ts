import * as SecureStore from "expo-secure-store";

/**
 * Keychain / Keystore entries that never leave this phone and can only be
 * read while it is unlocked (WHEN_UNLOCKED_THIS_DEVICE_ONLY): an encrypted
 * iPhone backup or a phone-to-phone transfer cannot carry them to another
 * device. Shaped as a Convex Auth `TokenStorage`.
 *
 * Entries saved before used expo-secure-store's default accessibility
 * (WHEN_UNLOCKED, which migrates). Writing over an existing item only
 * changes its value, so the first read moves such an entry to its own
 * keychain service with the new accessibility and deletes the old one.
 */
const DEVICE_ONLY: SecureStore.SecureStoreOptions = {
  keychainService: "keeplas.device-only",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const deviceStore = {
  getItem(key: string): string | null {
    const value = SecureStore.getItem(key, DEVICE_ONLY);
    if (value !== null) return value;
    const legacy = SecureStore.getItem(key);
    if (legacy === null) return null;
    SecureStore.setItem(key, legacy, DEVICE_ONLY);
    void SecureStore.deleteItemAsync(key).catch(() => undefined);
    return legacy;
  },
  setItem(key: string, value: string): void {
    SecureStore.setItem(key, value, DEVICE_ONLY);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key, DEVICE_ONLY);
    await SecureStore.deleteItemAsync(key);
  },
};
