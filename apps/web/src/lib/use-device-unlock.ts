import { useCallback, useEffect, useState } from "react";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  DeviceUnlockOwner,
  EnrollOptions,
  enrollMethod as enrollMethodImpl,
  deleteMethod as deleteMethodImpl,
  listMethods,
  unlockWith,
} from "./device-unlock";

type DeviceUnlockUser = Pick<Doc<"users">, "_id" | "email" | "phoneNumber">;

/** Owner of this browser's device-unlock entries for `user`. */
export function deviceUnlockOwner(user: DeviceUnlockUser): DeviceUnlockOwner {
  return {
    userId: user._id,
    accountName: user.email ?? user.phoneNumber ?? "Keeplas",
  };
}

/** Device-unlock entries of the signed-in user (`users.viewer`). */
export function useDeviceUnlock(user: DeviceUnlockUser | null | undefined) {
  const userId = user?._id ?? null;
  const legacyEmail = user?.email;
  const accountName = user ? deviceUnlockOwner(user).accountName : null;
  const [entries, setEntries] = useState<DeviceUnlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DeviceUnlockError | null>(null);

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
      if (!userId || !accountName) {
        throw new DeviceUnlockError("No signed-in user", "io");
      }
      const entry = await enrollMethodImpl(
        { userId, accountName },
        masterKey,
        options,
      );
      await refresh();
      return entry;
    },
    [userId, accountName, refresh],
  );

  const unlock = useCallback(
    async (entryId: string, secret?: string) => {
      const key = await unlockWith(entryId, secret);
      await refresh();
      return key;
    },
    [refresh],
  );

  const remove = useCallback(
    async (entryId: string) => {
      await deleteMethodImpl(entryId);
      await refresh();
    },
    [refresh],
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
