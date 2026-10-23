import { useCallback, useState, useSyncExternalStore } from "react";

const drafts = new Map<string, unknown>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readFormDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function writeFormDraft<T extends object>(key: string, value: T) {
  drafts.set(key, value);
  emit();
}

export function clearFormDrafts() {
  drafts.clear();
  emit();
}

export function useFormDraft<T extends object>(key: string, initial: () => T) {
  const [fallback] = useState(initial);
  const value = useSyncExternalStore(
    subscribe,
    () => readFormDraft<T>(key) ?? fallback,
  );

  const update = useCallback(
    (patch: Partial<T> | ((current: T) => Partial<T>)) => {
      const current = readFormDraft<T>(key) ?? fallback;
      const next = typeof patch === "function" ? patch(current) : patch;
      writeFormDraft(key, { ...current, ...next });
    },
    [key, fallback],
  );

  const clear = useCallback(() => {
    drafts.delete(key);
    emit();
  }, [key]);

  return [value, update, clear] as const;
}
