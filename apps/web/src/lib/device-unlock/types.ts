import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { PinReleaseResult } from "@keeplas/backend/device_pins";

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
  /**
   * Convex `device_pins` row holding the other half of the wrap key. Every
   * PIN saved since server-assisted unlock has one. Without it, the entry is
   * a legacy wrap under the PIN alone, re-sealed on its next unlock.
   */
  serverPinId?: Id<"device_pins">;
  /** Legacy entries only: wrong PINs counted in this browser. */
  failCount: number;
  lockedUntil?: number;
}

export type DeviceUnlockEntry = DeviceUnlockEntryBase & { data: PinEntryData };

export interface EnrollPinOptions {
  pin: string;
  label?: string;
}

export type EnrollOptions = { method: "pin" } & EnrollPinOptions;

/** The Convex side of a PIN (packages/convex/device_pins.ts). */
export interface PinServer {
  enroll(args: {
    pinProof: string;
    secret: string;
  }): Promise<{ pinId: Id<"device_pins">; trusted: boolean }>;
  release(args: {
    pinId: Id<"device_pins">;
    pinProof: string;
  }): Promise<PinReleaseResult>;
  remove(args: { pinId: Id<"device_pins"> }): Promise<null>;
}

export interface UnlockResult {
  key: CryptoKey;
  /** Linked with "Keep me logged in" (false when unknown). */
  trusted: boolean;
}

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

/** Digits of a new PIN. PINs saved before (6+ digits) still unlock. */
export const PIN_LENGTH = 4;
// Local limits of legacy entries; server-assisted ones are counted by Convex.
export const PIN_LOCKOUT_THRESHOLD = 5;
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_WIPE_THRESHOLD = 10;
