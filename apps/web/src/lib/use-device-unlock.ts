import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  EnrollOptions,
  PinServer,
  enrollMethod as enrollMethodImpl,
  deleteMethod as deleteMethodImpl,
  listMethods,
  unlockWith,
} from "./device-unlock";
import { useAuditedMutation } from "./use-audited-mutation";

type DeviceUnlockUser = Pick<Doc<"users">, "_id" | "email">;

/** The failed unlock deleted its entry (too many wrong PINs, or forgotten). */
export function isRemovedEntry(err: unknown): boolean {
  return (
    err instanceof DeviceUnlockError &&
    (err.code === "wiped" || err.code === "not-found")
  );
}

/** Device-unlock entries of the signed-in user (`users.viewer`). */
export function useDeviceUnlock(user: DeviceUnlockUser | null | undefined) {
  const userId = user?._id ?? null;
  const legacyEmail = user?.email;
  const [entries, setEntries] = useState<DeviceUnlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DeviceUnlockError | null>(null);
  const enrollPin = useAuditedMutation(api.device_pins.enroll);
  const releasePin = useAuditedMutation(api.device_pins.release);
  const removePin = useAuditedMutation(api.device_pins.remove);
  const server = useMemo<PinServer>(
    () => ({ enroll: enrollPin, release: releasePin, remove: removePin }),
    [enrollPin, releasePin, removePin],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      const list = await listMethods(userId, legacyEmail);
      setEntries(list);
      setError(null);
    } catch (err) {
      if (err instanceof DeviceUnlockError) {
        setError(err);
      } else {
        setError(
          new DeviceUnlockError("Failed to list methods", "io", { cause: err }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId, legacyEmail]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const enroll = useCallback(
    async (masterKey: CryptoKey, options: EnrollOptions) => {
      if (!userId) {
        throw new DeviceUnlockError("No signed-in user", "io");
      }
      const entry = await enrollMethodImpl(userId, masterKey, options, server);
      await refresh();
      return entry;
    },
    [userId, refresh, server],
  );

  const unlock = useCallback(
    async (entryId: string, secret?: string) => {
      try {
        const result = await unlockWith(entryId, secret, server);
        await refresh();
        return result;
      } catch (err) {
        // A wiped or forgotten PIN is gone from this browser: show it.
        if (isRemovedEntry(err)) await refresh();
        throw err;
      }
    },
    [refresh, server],
  );

  const remove = useCallback(
    async (entryId: string) => {
      await deleteMethodImpl(entryId, server);
      await refresh();
    },
    [refresh, server],
  );

  return {
    entries,
    loading,
    error,
    refresh,
    enroll,
    unlock,
    remove,
  };
}
