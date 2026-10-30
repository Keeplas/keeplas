import { argon2idRaw, deriveDeviceWrapKey } from "@keeplas/crypto/kdf";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  PIN_LOCKOUT_MS,
  PIN_LOCKOUT_THRESHOLD,
  PIN_LENGTH,
  PIN_WIPE_THRESHOLD,
  PinEntryData,
  PinServer,
  UnlockResult,
} from "./types";
import {
  exportMasterKey,
  importMasterKey,
  unwrapWithKey,
  wrapWithKey,
} from "./key-import";
import { deleteEntry, putEntry } from "./storage";

/*
 * Device PIN, server-assisted.
 *
 * A 4-digit PIN has 10^4 values, so a MasterKey wrapped under the PIN alone
 * falls to an offline search of a copied browser profile in minutes. The
 * wrap key therefore needs two halves:
 *   stretched = Argon2id(PIN, deviceSalt)            (deviceSalt stays here)
 *   wrapKey   = HKDF(stretched, salt = secret)       (secret: 32 random bytes)
 * Convex keeps `secret` and the SHA-256 of a PIN proof (HKDF of `stretched`),
 * and returns `secret` only to the session that saved the PIN, after a
 * correct proof, counting wrong ones server-side (packages/convex/device_pins.ts).
 * Neither side alone can test a PIN guess: the browser lacks `secret`, the
 * server lacks `deviceSalt` and the wrapped key. The server never sees the
 * MasterKey or the PIN.
 */

const PROOF_INFO = new TextEncoder().encode("keeplas/device-pin/proof/v1");
const WRAP_INFO = new TextEncoder().encode("keeplas/device-pin/wrap/v1");

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

/** Any PIN this browser may hold: digits only, 4 or more (older ones: 6+). */
export function assertPinShape(pin: string): void {
  if (!/^\d+$/.test(pin)) {
    throw new DeviceUnlockError("PIN must contain digits only", "wrong-secret");
  }
  if (pin.length < PIN_LENGTH) {
    throw new DeviceUnlockError(
      `PIN must be at least ${PIN_LENGTH} digits`,
      "wrong-secret",
    );
  }
}

/** A new PIN: exactly PIN_LENGTH digits. */
export function validatePin(pin: string): void {
  assertPinShape(pin);
  if (pin.length !== PIN_LENGTH) {
    throw new DeviceUnlockError(
      `PIN must be ${PIN_LENGTH} digits`,
      "wrong-secret",
    );
  }
}

/** Argon2id(PIN, deviceSalt) as an HKDF key; the raw bytes are wiped. */
async function stretchPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await argon2idRaw(pin, salt);
  try {
    return await crypto.subtle.importKey(
      "raw",
      raw as BufferSource,
      "HKDF",
      false,
      ["deriveBits", "deriveKey"],
    );
  } finally {
    raw.fill(0);
  }
}

/** What Convex checks (as a hash): proves the PIN, reveals nothing usable. */
async function pinProof(stretched: CryptoKey): Promise<string> {
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: PROOF_INFO },
    stretched,
    256,
  );
  return uint8ToBase64(new Uint8Array(bits));
}

function wrapKeyFor(
  stretched: CryptoKey,
  secret: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: secret as BufferSource,
      info: WRAP_INFO,
    },
    stretched,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Wrap the MasterKey under `pin` + a fresh server-held secret. */
async function sealPin(
  masterKey: CryptoKey,
  pin: string,
  server: PinServer,
): Promise<{ data: PinEntryData; trusted: boolean }> {
  const deviceSalt = crypto.getRandomValues(new Uint8Array(16));
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const raw = await exportMasterKey(masterKey);
  try {
    const stretched = await stretchPin(pin, deviceSalt);
    const { pinId, trusted } = await server.enroll({
      pinProof: await pinProof(stretched),
      secret: uint8ToBase64(secret),
    });
    const { iv, wrapped } = await wrapWithKey(
      raw,
      await wrapKeyFor(stretched, secret),
    );
    return {
      trusted,
      data: {
        kind: "pin",
        deviceSalt: uint8ToBase64(deviceSalt),
        iv,
        wrappedMasterKey: wrapped,
        serverPinId: pinId,
        failCount: 0,
      },
    };
  } finally {
    raw.fill(0);
    secret.fill(0);
  }
}

export async function enrollPin(
  userId: string,
  masterKey: CryptoKey,
  pin: string,
  server: PinServer,
  label?: string,
): Promise<DeviceUnlockEntry> {
  validatePin(pin);
  const { data } = await sealPin(masterKey, pin, server);
  const entry: DeviceUnlockEntry = {
    id: uuid(),
    userId,
    method: "pin",
    label: label || detectDeviceLabel(),
    createdAt: Date.now(),
    data,
  };
  await putEntry(entry);
  return entry;
}

export async function unlockWithPin(
  entry: DeviceUnlockEntry,
  pin: string,
  server: PinServer,
): Promise<UnlockResult> {
  const { serverPinId, deviceSalt, iv, wrappedMasterKey } = entry.data;
  if (!serverPinId) return unlockLegacyPin(entry, pin, server);

  assertPinShape(pin);
  const stretched = await stretchPin(pin, base64ToUint8(deviceSalt));
  const result = await server.release({
    pinId: serverPinId,
    pinProof: await pinProof(stretched),
  });
  switch (result.status) {
    case "ok": {
      const secret = base64ToUint8(result.secret);
      try {
        const raw = await unwrapWithKey(
          wrappedMasterKey,
          iv,
          await wrapKeyFor(stretched, secret),
        );
        try {
          return { key: await importMasterKey(raw), trusted: result.trusted };
        } finally {
          raw.fill(0);
        }
      } finally {
        secret.fill(0);
      }
    }
    case "wrong":
      throw new DeviceUnlockError(
        `Wrong PIN (${result.failCount}/${result.maxAttempts})`,
        "wrong-secret",
      );
    case "locked":
      throw new DeviceUnlockError(
        `Locked for ${Math.ceil(result.retryAfterMs / 1000)}s`,
        "locked",
      );
    case "wiped":
      await deleteEntry(entry.id);
      throw new DeviceUnlockError(
        "Too many wrong attempts. PIN entry wiped. Link this browser with your phone again.",
        "wiped",
      );
    case "gone":
      // Signed out, linked again or removed: the wrap opens nothing now.
      await deleteEntry(entry.id);
      throw new DeviceUnlockError(
        "This PIN no longer works on this browser. Link it with your phone again.",
        "not-found",
      );
  }
}

function isLocked(data: PinEntryData): number {
  if (!data.lockedUntil) return 0;
  const remaining = data.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * An entry saved before server-assisted unlock (PIN-only wrap, local attempt
 * limit). It keeps unlocking with its PIN, then is re-sealed with a server
 * half under the same PIN. If that upgrade fails (offline), it stays legacy
 * until the next unlock, and the trust of the link is unknown (false).
 */
async function unlockLegacyPin(
  entry: DeviceUnlockEntry,
  pin: string,
  server: PinServer,
): Promise<UnlockResult> {
  const data = entry.data;
  const lockMs = isLocked(data);
  if (lockMs > 0) {
    throw new DeviceUnlockError(
      `Locked for ${Math.ceil(lockMs / 1000)}s`,
      "locked",
    );
  }

  assertPinShape(pin);
  const wrapKey = await deriveDeviceWrapKey(
    pin,
    base64ToUint8(data.deviceSalt),
  );

  let key: CryptoKey;
  try {
    const raw = await unwrapWithKey(data.wrappedMasterKey, data.iv, wrapKey);
    // Reset failure counter on success
    if (data.failCount > 0 || data.lockedUntil) {
      await putEntry({
        ...entry,
        data: { ...data, failCount: 0, lockedUntil: undefined },
      });
    }
    try {
      key = await importMasterKey(raw);
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
        "Too many wrong attempts. PIN entry wiped. Link this browser with your phone again.",
        "wiped",
        { cause: err },
      );
    }
    const lockedUntil =
      newFail >= PIN_LOCKOUT_THRESHOLD
        ? Date.now() + PIN_LOCKOUT_MS
        : undefined;
    await putEntry({
      ...entry,
      data: { ...data, failCount: newFail, lockedUntil },
    });
    if (lockedUntil) {
      throw new DeviceUnlockError(
        `Wrong PIN. Locked for ${PIN_LOCKOUT_MS / 1000}s`,
        "locked",
        { cause: err },
      );
    }
    throw new DeviceUnlockError(
      `Wrong PIN (${newFail}/${PIN_WIPE_THRESHOLD})`,
      "wrong-secret",
      { cause: err },
    );
  }

  try {
    const { data: sealed, trusted } = await sealPin(key, pin, server);
    await putEntry({ ...entry, data: sealed });
    return { key, trusted };
  } catch (err) {
    console.warn("Device PIN upgrade failed; retrying at next unlock.", err);
    return { key, trusted: false };
  }
}
