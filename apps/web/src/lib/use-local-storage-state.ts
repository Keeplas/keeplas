import { useCallback, useMemo, useSyncExternalStore } from "react";

type Updater<T> = T | ((prev: T) => T);

function subscribeToKey(key: string) {
  return (notify: () => void) => {
    if (typeof window === "undefined") return () => {};
    function onEvent(e: StorageEvent | CustomEvent) {
      if (e instanceof StorageEvent && e.key !== null && e.key !== key) return;
      notify();
    }
    window.addEventListener("storage", onEvent as EventListener);
    window.addEventListener("keeplas:storage-change", onEvent as EventListener);
    return () => {
      window.removeEventListener("storage", onEvent as EventListener);
      window.removeEventListener(
        "keeplas:storage-change",
        onEvent as EventListener,
      );
    };
  };
}

function notifyLocalChange(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("keeplas:storage-change", { detail: { key } }),
  );
}

function safeWrite(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    notifyLocalChange(key);
  } catch {
    // Storage unavailable — ignore
  }
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalStorageState<T extends object>(
  key: string,
  defaultValue: T,
): [T, (next: Updater<T>) => void] {
  const subscribe = useMemo(() => subscribeToKey(key), [key]);
  const getSnapshot = useCallback(() => readRaw(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const value = useMemo<T>(() => {
    if (raw === null) return defaultValue;
    try {
      const parsed = JSON.parse(raw) as Partial<T>;
      return { ...defaultValue, ...parsed };
    } catch {
      return defaultValue;
    }
  }, [raw, defaultValue]);

  const update = useCallback(
    (next: Updater<T>) => {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(value) : next;
      safeWrite(key, JSON.stringify(resolved));
    },
    [key, value],
  );

  return [value, update];
}

export function useLocalStorageString(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const subscribe = useMemo(() => subscribeToKey(key), [key]);
  const getSnapshot = useCallback(() => readRaw(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const value = raw ?? defaultValue;

  const update = useCallback(
    (next: string) => {
      safeWrite(key, next);
    },
    [key],
  );

  return [value, update];
}
