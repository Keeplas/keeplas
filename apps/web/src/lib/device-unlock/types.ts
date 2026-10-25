export type DeviceUnlockMethod = "pin";

export interface DeviceUnlockEntryBase {
  id: string;
  userId: string;
  /** Pre-v2 storage key, only read by the one-time migration in storage.ts. */
  userEmail?: string;
  method: DeviceUnlockMethod;
  label: string;
  createdAt: number;
}

export interface PinEntryData {
  kind: "pin";
  deviceSalt: string;
  iv: string;
  wrappedMasterKey: string;
  failCount: number;
  lockedUntil?: number;
}

export type DeviceUnlockEntry = DeviceUnlockEntryBase & { data: PinEntryData };

export interface EnrollPinOptions {
  pin: string;
  label?: string;
}

export type EnrollOptions = { method: "pin" } & EnrollPinOptions;

export class DeviceUnlockError extends Error {
  constructor(
    message: string,
    public code:
      "wrong-secret" | "locked" | "wiped" | "unsupported" | "not-found" | "io",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DeviceUnlockError";
  }
}

export const PIN_MIN_LENGTH = 6;
export const PIN_LOCKOUT_THRESHOLD = 5;
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_WIPE_THRESHOLD = 10;
