export type DeviceUnlockMethod = "pin" | "biometric" | "hardware-key";

export interface DeviceUnlockEntryBase {
  id: string;
  userEmail: string;
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

export interface WebAuthnPrfEntryData {
  kind: "webauthn-prf";
  attachment: "platform" | "cross-platform";
  credentialId: string;
  prfSalt: string;
  iv: string;
  wrappedMasterKey: string;
}

export type DeviceUnlockEntry = DeviceUnlockEntryBase &
  ({ data: PinEntryData } | { data: WebAuthnPrfEntryData });

export interface EnrollPinOptions {
  pin: string;
  label?: string;
}

export interface EnrollWebAuthnOptions {
  attachment: "platform" | "cross-platform";
  label?: string;
}

export type EnrollOptions =
  | ({ method: "pin" } & EnrollPinOptions)
  | ({ method: "biometric" | "hardware-key" } & EnrollWebAuthnOptions);

export class DeviceUnlockError extends Error {
  constructor(
    message: string,
    public code:
      | "wrong-secret"
      | "locked"
      | "wiped"
      | "unsupported"
      | "cancelled"
      | "not-found"
      | "io",
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
