import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  DeviceUnlockOwner,
  EnrollOptions,
} from "./types";
import { enrollPin, unlockWithPin } from "./pin";
import {
  enrollWebAuthnPrf,
  isWebAuthnSupported,
  unlockWithWebAuthnPrf,
} from "./webauthn-prf";
import { deleteEntry, getEntry, listEntriesForUser } from "./storage";

export type {
  CreatePrfCredential,
  DeviceUnlockEntry,
  DeviceUnlockMethod,
  DeviceUnlockOwner,
  EnrollOptions,
  PinEntryData,
  WebAuthnPrfEntryData,
} from "./types";
export { DeviceUnlockError, PIN_MIN_LENGTH } from "./types";
export { fromBase64Url, isWebAuthnSupported } from "./webauthn-prf";
export { validatePin } from "./pin";

export async function listMethods(
  userId: string,
  legacyEmail?: string,
): Promise<DeviceUnlockEntry[]> {
  return listEntriesForUser(userId, legacyEmail);
}

export async function enrollMethod(
  owner: DeviceUnlockOwner,
  masterKey: CryptoKey,
  options: EnrollOptions,
): Promise<DeviceUnlockEntry> {
  if (options.method === "pin") {
    return enrollPin(owner.userId, masterKey, options.pin, options.label);
  }
  return enrollWebAuthnPrf(
    owner,
    masterKey,
    options.attachment,
    options.label,
    options.createCredential,
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
