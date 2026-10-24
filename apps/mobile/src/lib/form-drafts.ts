import { useCallback, useState, useSyncExternalStore } from "react";

export interface FormDraftDb {
  list(userId: string): Promise<{ key: string; value: unknown }[]>;
  put(userId: string, key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  removeAll(userId: string): Promise<void>;
}

export const FORM_DRAFT_SAVE_MS = 400;

const drafts = new Map<string, unknown>();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let io: { userId: string; db: FormDraftDb } | null = null;
let pending: Promise<void> = Promise.resolve();

const kept = (key: string) => key.startsWith("edit:");

function queue(task: (db: FormDraftDb, userId: string) => Promise<void>) {
  if (!io) return;
  const { db, userId } = io;
  pending = pending.then(() => task(db, userId)).catch(() => undefined);
}

function stopTimer(key: string) {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

export async function attachFormDrafts(userId: string, db: FormDraftDb) {
  io = { userId, db };
  const rows = await db.list(userId).catch(() => []);
  for (const { key, value } of rows) {
    if (!drafts.has(key)) drafts.set(key, value);
  }
  emit();
}

export function formDraftsSettled() {
  return pending;
}

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
  if (!kept(key) || !io) return;
  stopTimer(key);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      queue((db, userId) => db.put(userId, key, drafts.get(key)));
    }, FORM_DRAFT_SAVE_MS),
  );
}

export function removeFormDraft(key: string) {
  stopTimer(key);
  drafts.delete(key);
  emit();
  if (kept(key)) queue((db) => db.remove(key));
}

export function clearFormDrafts() {
  for (const key of timers.keys()) stopTimer(key);
  drafts.clear();
  emit();
  queue((db, userId) => db.removeAll(userId));
  io = null;
}

export function useStoredFormDraft<T>(key: string): T | undefined {
  return useSyncExternalStore(subscribe, () => readFormDraft<T>(key));
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

  const clear = useCallback(() => removeFormDraft(key), [key]);

  return [value, update, clear] as const;
}
