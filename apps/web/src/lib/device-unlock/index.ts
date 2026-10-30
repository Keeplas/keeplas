import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  EnrollOptions,
  PinServer,
  UnlockResult,
} from "./types";
import { enrollPin, unlockWithPin } from "./pin";
import {
  clearEntries,
  deleteEntry,
  getEntry,
  listAllEntries,
  listEntriesForUser,
} from "./storage";

export type {
  DeviceUnlockEntry,
  DeviceUnlockMethod,
  EnrollOptions,
  PinEntryData,
  PinServer,
  UnlockResult,
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
  server: PinServer,
): Promise<DeviceUnlockEntry> {
  return enrollPin(userId, masterKey, options.pin, server, options.label);
}

export async function unlockWith(
  entryId: string,
  secret: string | undefined,
  server: PinServer,
): Promise<UnlockResult> {
  const entry = await getEntry(entryId);
  if (!entry) {
    throw new DeviceUnlockError("Entry not found", "not-found");
  }
  if (typeof secret !== "string") {
    throw new DeviceUnlockError("PIN required", "wrong-secret");
  }
  return unlockWithPin(entry, secret, server);
}

export async function deleteMethod(
  entryId: string,
  server: PinServer,
): Promise<void> {
  const pinId = (await getEntry(entryId))?.data.serverPinId;
  if (pinId) await server.remove({ pinId });
  await deleteEntry(entryId);
}

/**
 * Forget every PIN of this browser, when it is linked again: PINs belong to
 * the session that saved them, and a new link is a new session.
 */
export async function clearMethods(): Promise<void> {
  await clearEntries();
}

/**
 * On sign-out / session loss, drop the legacy PIN-only wraps: on disk they
 * can be brute-forced offline. Server-assisted ones are inert without the
 * server half, which ends with the session.
 */
export async function clearLegacyMethods(): Promise<void> {
  const legacy = (await listAllEntries()).filter(
    (entry) => !entry.data?.serverPinId,
  );
  await Promise.all(legacy.map((entry) => deleteEntry(entry.id)));
}
