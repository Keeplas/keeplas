"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  EnrollOptions,
  enrollMethod as enrollMethodImpl,
  deleteMethod as deleteMethodImpl,
  listMethods,
  unlockWith,
} from "./device-unlock";

interface UseDeviceUnlockOptions {
  userEmail: string | null | undefined;
}

export function useDeviceUnlock({ userEmail }: UseDeviceUnlockOptions) {
  const [entries, setEntries] = useState<DeviceUnlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DeviceUnlockError | null>(null);

  const refresh = useCallback(async () => {
    if (!userEmail) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      const list = await listMethods(userEmail);
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
  }, [userEmail]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const enroll = useCallback(
    async (masterKey: CryptoKey, options: EnrollOptions) => {
      if (!userEmail) {
        throw new DeviceUnlockError("No user email", "io");
      }
      const entry = await enrollMethodImpl(userEmail, masterKey, options);
      await refresh();
      return entry;
    },
    [userEmail, refresh],
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
