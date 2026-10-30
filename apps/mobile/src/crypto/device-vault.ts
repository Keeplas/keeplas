import * as SecureStore from "expo-secure-store";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";
import { deriveDeviceWrapKey } from "@keeplas/crypto/kdf";

import * as DeviceLock from "../../modules/device-lock";
import { fresh, importAesKey, randomBytes } from "./envelope";
import { opensOwnerKey, type OwnerKeyFields } from "./owner-keys";
import { openKeyBundleWithRootKey } from "./vault-keys";

/**
 * Per-device unlock (M08-6). The MasterKey (and the RootKey, when known) is
 * kept AES-GCM-wrapped by a random 32-byte device wrap key (DWK). The DWK
 * lives in the Keychain / Keystore behind the phone's screen lock (Face ID /
 * fingerprint or the PIN / passcode, this device only), so reading it is the
 * unlock. Nothing here leaves the phone; signing out deletes both entries.
 */
const dwkKey = (userId: string) => `keeplas.dwk.${userId}`;
const wrappedKey = (userId: string) => `keeplas.mk.${userId}`;
const deviceIdKey = (userId: string) => `keeplas.device.${userId}`;

const LOCAL: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface Sealed {
  iv: string;
  ct: string;
}

type Inner = Sealed & { rk?: Sealed };

interface PinLayer {
  salt: string;
  /** Digits of the PIN; absent on PINs saved before 4-digit PINs (all 6). */
  length?: number;
  iv: string;
  ct: string;
  failCount: number;
  lockedUntil?: number;
}

type Stored = Inner | { pin: PinLayer };

export const PIN_LENGTH = 4;
const LEGACY_PIN_LENGTH = 6;
export const PIN_LOCKOUT_THRESHOLD = 5;
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_WIPE_THRESHOLD = 10;

export class DevicePinError extends Error {
  constructor(
    public code: "required" | "wrong" | "locked" | "wiped",
    public detail: { remaining?: number; lockedUntil?: number } = {},
  ) {
    super(`Device PIN ${code}`);
    this.name = "DevicePinError";
  }
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

/**
 * Wrap and store the MasterKey (and the RootKey when this phone knows it:
 * cloud backup and key rotation need it) for this user on this device.
 */
export async function saveDeviceVault(
  userId: string,
  keys: { masterKey: Uint8Array; rootKey: Uint8Array | null },
  prompt: string,
  pin?: string,
): Promise<void> {
  const dwk = randomBytes(32);
  const key = await importAesKey(dwk);
  const inner: Inner = await seal(keys.masterKey, key);
  if (keys.rootKey) inner.rk = await seal(keys.rootKey, key);
  let stored: Stored = inner;
  if (pin) {
    const salt = randomBytes(16);
    const pinKey = await deriveDeviceWrapKey(pin, salt);
    const layer = await seal(
      new TextEncoder().encode(JSON.stringify(inner)),
      pinKey,
    );
    stored = {
      pin: {
        salt: uint8ToBase64(salt),
        length: pin.length,
        ...layer,
        failCount: 0,
      },
    };
  }
  await DeviceLock.setItem(dwkKey(userId), uint8ToBase64(dwk), prompt);
  dwk.fill(0);
  await SecureStore.setItemAsync(
    wrappedKey(userId),
    JSON.stringify(stored),
    LOCAL,
  );
}

export async function hasDeviceVault(userId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(wrappedKey(userId), LOCAL)) !== null;
}

async function readStored(userId: string): Promise<Stored | null> {
  const stored = await SecureStore.getItemAsync(wrappedKey(userId), LOCAL);
  return stored ? (JSON.parse(stored) as Stored) : null;
}

/** Digits of this phone's Keeplas PIN, or null when it has none. */
export async function devicePinLength(userId: string): Promise<number | null> {
  const stored = await readStored(userId);
  if (!stored || !("pin" in stored)) return null;
  return stored.pin.length ?? LEGACY_PIN_LENGTH;
}

async function writeLayer(userId: string, layer: PinLayer): Promise<void> {
  await SecureStore.setItemAsync(
    wrappedKey(userId),
    JSON.stringify({ pin: layer }),
    LOCAL,
  );
}

let pinQueue: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = pinQueue.then(task, task);
  pinQueue = run.catch(() => undefined);
  return run;
}

async function openPinLayer(
  userId: string,
  layer: PinLayer,
  pin: string | undefined,
): Promise<Inner> {
  if (!pin) throw new DevicePinError("required");
  if (layer.lockedUntil && layer.lockedUntil > Date.now()) {
    throw new DevicePinError("locked", { lockedUntil: layer.lockedUntil });
  }
  try {
    const pinKey = await deriveDeviceWrapKey(pin, base64ToUint8(layer.salt));
    const inner = JSON.parse(
      new TextDecoder().decode(await open(layer, pinKey)),
    ) as Inner;
    if (layer.failCount > 0) {
      await writeLayer(userId, {
        ...layer,
        failCount: 0,
        lockedUntil: undefined,
      });
    }
    return inner;
  } catch {
    const failCount = layer.failCount + 1;
    if (failCount >= PIN_WIPE_THRESHOLD) {
      await forgetDeviceVault(userId);
      throw new DevicePinError("wiped");
    }
    const lockedUntil =
      failCount >= PIN_LOCKOUT_THRESHOLD
        ? Date.now() + PIN_LOCKOUT_MS
        : undefined;
    await writeLayer(userId, { ...layer, failCount, lockedUntil });
    throw lockedUntil
      ? new DevicePinError("locked", { lockedUntil })
      : new DevicePinError("wrong", {
          remaining: PIN_LOCKOUT_THRESHOLD - failCount,
        });
  }
}

/** Screen-lock prompt → raw MasterKey, and the RootKey when this phone knows it. */
export async function openDeviceVault(
  userId: string,
  prompt: string,
  pin?: string,
): Promise<{ masterKey: Uint8Array; rootKey: Uint8Array | null }> {
  const inner = await oneAtATime(async () => {
    const stored = await readStored(userId);
    if (!stored) throw new Error("No vault key on this device");
    return "pin" in stored ? openPinLayer(userId, stored.pin, pin) : stored;
  });
  const dwkB64 = await DeviceLock.getItem(dwkKey(userId), prompt);
  if (!dwkB64) throw new Error("Device key unavailable");
  const dwk = base64ToUint8(dwkB64);
  try {
    const key = await importAesKey(dwk);
    return {
      masterKey: await open(inner, key),
      rootKey: inner.rk ? await open(inner.rk, key) : null,
    };
  } finally {
    dwk.fill(0);
  }
}

/**
 * This phone's keys predate a master-key rotation made on another device:
 * neither its MasterKey nor its RootKey opens the account's keys any more.
 * The vault must be opened again (cloud backup, 24 words or a QR link).
 */
export class StaleDeviceVault extends Error {
  constructor() {
    super("This phone holds keys from before a key rotation");
    this.name = "StaleDeviceVault";
  }
}

/**
 * {@link openDeviceVault}, checked against the account. When the stored
 * MasterKey no longer opens the owner key (rotated elsewhere, or this phone
 * lost the rotation's response), the stored RootKey may still open the new
 * bundle: the current MasterKey is then stored instead. Otherwise throws
 * {@link StaleDeviceVault}, so a retired key is never used (nor re-sealed
 * into a new kit).
 */
export async function openCurrentDeviceVault(
  user: Pick<OwnerKeyFields, "_id" | "encryptedAsymmetricSecretKey"> & {
    encryptedKeyBundle?: string;
  },
  prompt: string,
  pin?: string,
): Promise<{ masterKey: Uint8Array; rootKey: Uint8Array | null }> {
  const keys = await openDeviceVault(user._id, prompt, pin);
  const opens = async (raw: Uint8Array) =>
    opensOwnerKey(user, await importAesKey(raw));
  if (await opens(keys.masterKey)) return keys;
  keys.masterKey.fill(0);
  const current =
    keys.rootKey && user.encryptedKeyBundle
      ? await openKeyBundleWithRootKey(
          user.encryptedKeyBundle,
          keys.rootKey,
        ).catch(() => null)
      : null;
  if (current && (await opens(current))) {
    const caughtUp = { masterKey: current, rootKey: keys.rootKey };
    await saveDeviceVault(user._id, caughtUp, prompt, pin);
    return caughtUp;
  }
  current?.fill(0);
  keys.rootKey?.fill(0);
  throw new StaleDeviceVault();
}

export async function setDevicePin(
  userId: string,
  prompt: string,
  currentPin: string | undefined,
  nextPin: string | undefined,
): Promise<void> {
  const keys = await openDeviceVault(userId, prompt, currentPin);
  try {
    await saveDeviceVault(userId, keys, prompt, nextPin);
  } finally {
    keys.masterKey.fill(0);
    keys.rootKey?.fill(0);
  }
}

/**
 * Screen-lock prompt → raw MasterKey. Throws when the user cancels or the
 * screen lock was removed (the Keychain / Keystore item is then invalidated).
 */
export async function unlockDeviceVault(
  userId: string,
  prompt: string,
  pin?: string,
): Promise<Uint8Array> {
  const { masterKey, rootKey } = await openDeviceVault(userId, prompt, pin);
  rootKey?.fill(0);
  return masterKey;
}

/**
 * Screen-lock prompt → raw RootKey, or null when this phone never learned it
 * (vault opened by contacts or another device without a new kit).
 */
export async function readDeviceRootKey(
  userId: string,
  prompt: string,
  pin?: string,
): Promise<Uint8Array | null> {
  const { masterKey, rootKey } = await openDeviceVault(userId, prompt, pin);
  masterKey.fill(0);
  return rootKey;
}

export async function forgetDeviceVault(userId: string): Promise<void> {
  await DeviceLock.deleteItem(dwkKey(userId));
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
