import { deriveDeviceWrapKey } from "@keeplas/crypto/kdf";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  PIN_LOCKOUT_MS,
  PIN_LOCKOUT_THRESHOLD,
  PIN_MIN_LENGTH,
  PIN_WIPE_THRESHOLD,
  PinEntryData,
} from "./types";
import {
  exportMasterKey,
  importMasterKey,
  unwrapWithKey,
  wrapWithKey,
} from "./key-import";
import { deleteEntry, putEntry } from "./storage";

function uuid(): string {
  return crypto.randomUUID();
}

function detectDeviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone PIN";
  if (/iPad/i.test(ua)) return "iPad PIN";
  if (/Android/i.test(ua)) return "Android PIN";
  if (/Macintosh/i.test(ua)) return "Mac PIN";
  if (/Windows/i.test(ua)) return "Windows PIN";
  return "Device PIN";
}

export function validatePin(pin: string): void {
  if (!/^\d+$/.test(pin)) {
    throw new DeviceUnlockError("PIN must contain digits only", "wrong-secret");
  }
  if (pin.length < PIN_MIN_LENGTH) {
    throw new DeviceUnlockError(
      `PIN must be at least ${PIN_MIN_LENGTH} digits`,
      "wrong-secret"
    );
  }
}

export async function enrollPin(
  userEmail: string,
  masterKey: CryptoKey,
  pin: string,
  label?: string
): Promise<DeviceUnlockEntry> {
  validatePin(pin);
  const deviceSalt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveDeviceWrapKey(pin, deviceSalt);
  const raw = await exportMasterKey(masterKey);
  try {
    const { iv, wrapped } = await wrapWithKey(raw, wrapKey);
    const entry: DeviceUnlockEntry = {
      id: uuid(),
      userEmail,
      method: "pin",
      label: label || detectDeviceLabel(),
      createdAt: Date.now(),
      data: {
        kind: "pin",
        deviceSalt: uint8ToBase64(deviceSalt),
        iv,
        wrappedMasterKey: wrapped,
        failCount: 0,
      },
    };
    await putEntry(entry);
    return entry;
  } finally {
    raw.fill(0);
  }
}

function isLocked(data: PinEntryData): number {
  if (!data.lockedUntil) return 0;
  const remaining = data.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

export async function unlockWithPin(
  entry: DeviceUnlockEntry,
  pin: string
): Promise<CryptoKey> {
  if (entry.data.kind !== "pin") {
    throw new DeviceUnlockError("Entry is not a PIN entry", "io");
  }
  const data = entry.data;
  const lockMs = isLocked(data);
  if (lockMs > 0) {
    throw new DeviceUnlockError(
      `Locked for ${Math.ceil(lockMs / 1000)}s`,
      "locked"
    );
  }

  validatePin(pin);
  const deviceSaltB64 = data.deviceSalt;
  const deviceSalt = Uint8Array.from(atob(deviceSaltB64), (c) =>
    c.charCodeAt(0)
  );
  const wrapKey = await deriveDeviceWrapKey(pin, deviceSalt);

  try {
    const raw = await unwrapWithKey(data.wrappedMasterKey, data.iv, wrapKey);
    // Reset failure counter on success
    if (data.failCount > 0 || data.lockedUntil) {
      const updated: DeviceUnlockEntry = {
        ...entry,
        data: { ...data, failCount: 0, lockedUntil: undefined },
      };
      await putEntry(updated);
    }
    try {
      return await importMasterKey(raw);
    } finally {
      raw.fill(0);
    }
  } catch (err) {
    if (err instanceof DeviceUnlockError) throw err;
    // AES-GCM auth tag mismatch → wrong PIN
    const newFail = data.failCount + 1;
    if (newFail >= PIN_WIPE_THRESHOLD) {
      await deleteEntry(entry.id);
      throw new DeviceUnlockError(
        "Too many wrong attempts — PIN entry wiped, please re-enroll with your 24 words",
        "wiped",
        { cause: err }
      );
    }
    const lockedUntil =
      newFail >= PIN_LOCKOUT_THRESHOLD ? Date.now() + PIN_LOCKOUT_MS : undefined;
    const updated: DeviceUnlockEntry = {
      ...entry,
      data: { ...data, failCount: newFail, lockedUntil },
    };
    await putEntry(updated);
    if (lockedUntil) {
      throw new DeviceUnlockError(
        `Wrong PIN. Locked for ${PIN_LOCKOUT_MS / 1000}s`,
        "locked",
        { cause: err }
      );
    }
    throw new DeviceUnlockError(
      `Wrong PIN (${newFail}/${PIN_WIPE_THRESHOLD})`,
      "wrong-secret",
      { cause: err }
    );
  }
}
