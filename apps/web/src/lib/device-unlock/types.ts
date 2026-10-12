export type DeviceUnlockMethod = "pin" | "biometric" | "hardware-key";

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

/**
 * Creates a PRF-capable WebAuthn credential and returns its raw id. Defaults
 * to a local-only credential; the QR link flow passes one that also registers
 * the credential as a server passkey, so a single passkey signs in and unlocks.
 */
export type CreatePrfCredential = (prfSalt: Uint8Array) => Promise<Uint8Array>;

export interface EnrollWebAuthnOptions {
  attachment: "platform" | "cross-platform";
  label?: string;
  createCredential?: CreatePrfCredential;
}

/** The account an entry belongs to. */
export interface DeviceUnlockOwner {
  userId: string;
  /** Account name shown by the OS passkey manager for local credentials. */
  accountName: string;
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
