import { DeviceUnlockEntry, DeviceUnlockError, EnrollOptions } from "./types";
import { enrollPin, unlockWithPin } from "./pin";
import { deleteEntry, getEntry, listEntriesForUser } from "./storage";

export type {
  DeviceUnlockEntry,
  DeviceUnlockMethod,
  EnrollOptions,
  PinEntryData,
} from "./types";
export { DeviceUnlockError, PIN_LENGTH } from "./types";
export { validatePin } from "./pin";

export async function listMethods(
  userId: string,
  legacyEmail?: string,
): Promise<DeviceUnlockEntry[]> {
  const entries = await listEntriesForUser(userId, legacyEmail);
  const retired = entries.filter((entry) => entry.method !== "pin");
  await Promise.all(retired.map((entry) => deleteEntry(entry.id)));
  return entries.filter((entry) => entry.method === "pin");
}

export async function enrollMethod(
  userId: string,
  masterKey: CryptoKey,
  options: EnrollOptions,
): Promise<DeviceUnlockEntry> {
  return enrollPin(userId, masterKey, options.pin, options.label);
}

export async function unlockWith(
  entryId: string,
  secret?: string,
): Promise<CryptoKey> {
  const entry = await getEntry(entryId);
  if (!entry) {
    throw new DeviceUnlockError("Entry not found", "not-found");
  }
  if (typeof secret !== "string") {
    throw new DeviceUnlockError("PIN required", "wrong-secret");
  }
  return unlockWithPin(entry, secret);
}

export async function deleteMethod(entryId: string): Promise<void> {
  await deleteEntry(entryId);
}
