import * as SecureStore from "expo-secure-store";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";

import { fresh, importAesKey, randomBytes } from "./envelope";

/**
 * Per-device unlock (M08-6). The MasterKey (and the RootKey, when known) is
 * kept AES-GCM-wrapped by a random 32-byte device wrap key (DWK). The DWK
 * lives in the Keychain /
 * Keystore behind `requireAuthentication` (Face ID / fingerprint, this
 * device only), so reading it is the biometric unlock. Nothing here leaves
 * the phone; signing out deletes both entries.
 */
const dwkKey = (userId: string) => `keeplas.dwk.${userId}`;
const wrappedKey = (userId: string) => `keeplas.mk.${userId}`;
const deviceIdKey = (userId: string) => `keeplas.device.${userId}`;

const BIOMETRIC: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};
const LOCAL: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface Sealed {
  iv: string;
  ct: string;
}

async function seal(raw: Uint8Array, key: CryptoKey): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fresh(raw),
  );
  return { iv: uint8ToBase64(iv), ct: uint8ToBase64(new Uint8Array(ct)) };
}

async function open(sealed: Sealed, key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(sealed.iv) },
      key,
      base64ToUint8(sealed.ct),
    ),
  );
}

/** True when the phone has a screen lock with biometrics this app can use. */
export function canUseBiometrics(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}

/**
 * Wrap and store the MasterKey (and the RootKey when this phone knows it:
 * cloud backup and key rotation need it) for this user on this device.
 */
export async function saveDeviceVault(
  userId: string,
  keys: { masterKey: Uint8Array; rootKey: Uint8Array | null },
  prompt: string,
): Promise<void> {
  const dwk = randomBytes(32);
  const key = await importAesKey(dwk);
  const wrapped: Sealed & { rk?: Sealed } = await seal(keys.masterKey, key);
  if (keys.rootKey) wrapped.rk = await seal(keys.rootKey, key);
  await SecureStore.setItemAsync(dwkKey(userId), uint8ToBase64(dwk), {
    ...BIOMETRIC,
    authenticationPrompt: prompt,
  });
  dwk.fill(0);
  await SecureStore.setItemAsync(
    wrappedKey(userId),
    JSON.stringify(wrapped),
    LOCAL,
  );
}

export async function hasDeviceVault(userId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(wrappedKey(userId), LOCAL)) !== null;
}

/** Biometric prompt → DWK → the stored keys. */
async function openDeviceVault(
  userId: string,
  prompt: string,
): Promise<{ masterKey: Uint8Array; rootKey: Uint8Array | null }> {
  const wrapped = await SecureStore.getItemAsync(wrappedKey(userId), LOCAL);
  if (!wrapped) throw new Error("No vault key on this device");
  const dwkB64 = await SecureStore.getItemAsync(dwkKey(userId), {
    ...BIOMETRIC,
    authenticationPrompt: prompt,
  });
  if (!dwkB64) throw new Error("Device key unavailable");
  const dwk = base64ToUint8(dwkB64);
  try {
    const key = await importAesKey(dwk);
    const sealed = JSON.parse(wrapped) as Sealed & { rk?: Sealed };
    return {
      masterKey: await open(sealed, key),
      rootKey: sealed.rk ? await open(sealed.rk, key) : null,
    };
  } finally {
    dwk.fill(0);
  }
}

/**
 * Biometric prompt → raw MasterKey. Throws when the user cancels or the
 * biometric set changed (the Keychain item is then invalidated).
 */
export async function unlockDeviceVault(
  userId: string,
  prompt: string,
): Promise<Uint8Array> {
  const { masterKey, rootKey } = await openDeviceVault(userId, prompt);
  rootKey?.fill(0);
  return masterKey;
}

/**
 * Biometric prompt → raw RootKey, or null when this phone never learned it
 * (vault opened by contacts or another device without a new kit).
 */
export async function readDeviceRootKey(
  userId: string,
  prompt: string,
): Promise<Uint8Array | null> {
  const { masterKey, rootKey } = await openDeviceVault(userId, prompt);
  masterKey.fill(0);
  return rootKey;
}

export async function forgetDeviceVault(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(dwkKey(userId), BIOMETRIC);
  await SecureStore.deleteItemAsync(wrappedKey(userId), LOCAL);
  await SecureStore.deleteItemAsync(deviceIdKey(userId), LOCAL);
}

/** Convex `devices` row id of this phone for `userId` (from devices.register). */
export function readDeviceId(userId: string): Promise<string | null> {
  return SecureStore.getItemAsync(deviceIdKey(userId), LOCAL);
}

export function writeDeviceId(userId: string, deviceId: string): Promise<void> {
  return SecureStore.setItemAsync(deviceIdKey(userId), deviceId, LOCAL);
}
