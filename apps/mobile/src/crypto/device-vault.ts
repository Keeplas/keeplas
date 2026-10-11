import * as SecureStore from "expo-secure-store";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";

/**
 * Per-device unlock (M08-6). The MasterKey is kept AES-GCM-wrapped by a
 * random 32-byte device wrap key (DWK). The DWK lives in the Keychain /
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

function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  return crypto.subtle.importKey("raw", buf, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** True when the phone has a screen lock with biometrics this app can use. */
export function canUseBiometrics(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}

/** Wrap and store the MasterKey for this user on this device. */
export async function saveDeviceVault(
  userId: string,
  rawMasterKey: Uint8Array,
  prompt: string,
): Promise<void> {
  const dwk = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = new Uint8Array(rawMasterKey.byteLength);
  buf.set(rawMasterKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(dwk),
    buf,
  );
  buf.fill(0);
  await SecureStore.setItemAsync(dwkKey(userId), uint8ToBase64(dwk), {
    ...BIOMETRIC,
    authenticationPrompt: prompt,
  });
  dwk.fill(0);
  await SecureStore.setItemAsync(
    wrappedKey(userId),
    JSON.stringify({
      iv: uint8ToBase64(iv),
      ct: uint8ToBase64(new Uint8Array(ciphertext)),
    }),
    LOCAL,
  );
}

export async function hasDeviceVault(userId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(wrappedKey(userId), LOCAL)) !== null;
}

/**
 * Biometric prompt → DWK → raw MasterKey. Throws when the user cancels or
 * the biometric set changed (the Keychain item is then invalidated).
 */
export async function unlockDeviceVault(
  userId: string,
  prompt: string,
): Promise<Uint8Array> {
  const wrapped = await SecureStore.getItemAsync(wrappedKey(userId), LOCAL);
  if (!wrapped) throw new Error("No vault key on this device");
  const dwkB64 = await SecureStore.getItemAsync(dwkKey(userId), {
    ...BIOMETRIC,
    authenticationPrompt: prompt,
  });
  if (!dwkB64) throw new Error("Device key unavailable");
  const dwk = base64ToUint8(dwkB64);
  const { iv, ct } = JSON.parse(wrapped) as { iv: string; ct: string };
  try {
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(iv) },
      await aesKey(dwk),
      base64ToUint8(ct),
    );
    return new Uint8Array(raw);
  } finally {
    dwk.fill(0);
  }
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
