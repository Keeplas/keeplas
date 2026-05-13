import { DeviceUnlockEntry, DeviceUnlockError, EnrollOptions } from "./types";
import { enrollPin, unlockWithPin } from "./pin";
import {
  enrollWebAuthnPrf,
  isWebAuthnSupported,
  unlockWithWebAuthnPrf,
} from "./webauthn-prf";
import {
  deleteAllForUser,
  deleteEntry,
  getEntry,
  listEntriesForUser,
} from "./storage";

export type {
  DeviceUnlockEntry,
  DeviceUnlockMethod,
  EnrollOptions,
  PinEntryData,
  WebAuthnPrfEntryData,
} from "./types";
export { DeviceUnlockError, PIN_MIN_LENGTH } from "./types";
export { isWebAuthnSupported } from "./webauthn-prf";
export { validatePin } from "./pin";

export async function listMethods(
  userEmail: string,
): Promise<DeviceUnlockEntry[]> {
  return listEntriesForUser(userEmail);
}

export async function enrollMethod(
  userEmail: string,
  masterKey: CryptoKey,
  options: EnrollOptions,
): Promise<DeviceUnlockEntry> {
  if (options.method === "pin") {
    return enrollPin(userEmail, masterKey, options.pin, options.label);
  }
  return enrollWebAuthnPrf(
    userEmail,
    masterKey,
    options.attachment,
    options.label,
  );
}

export async function unlockWith(
  entryId: string,
  secret?: string,
): Promise<CryptoKey> {
  const entry = await getEntry(entryId);
  if (!entry) {
    throw new DeviceUnlockError("Entry not found", "not-found");
  }
  if (entry.data.kind === "pin") {
    if (typeof secret !== "string") {
      throw new DeviceUnlockError("PIN required", "wrong-secret");
    }
    return unlockWithPin(entry, secret);
  }
  return unlockWithWebAuthnPrf(entry);
}

export async function deleteMethod(entryId: string): Promise<void> {
  await deleteEntry(entryId);
}

export async function deleteAllMethods(userEmail: string): Promise<void> {
  await deleteAllForUser(userEmail);
}

export async function hasAnyMethod(userEmail: string): Promise<boolean> {
  const list = await listEntriesForUser(userEmail);
  return list.length > 0;
}

export function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (
    !isWebAuthnSupported() ||
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    return Promise.resolve(false);
  }
  return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
    () => false,
  );
}
