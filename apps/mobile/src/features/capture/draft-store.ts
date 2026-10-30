/**
 * The captures being prepared (M07-2 scan, M07-3 voice, M07-7 / M07-8
 * compose). Each one is a draft kept on this phone until it is saved or
 * deleted: the text in the encrypted database, the files in the app's own
 * documents folder (kept out of backups, see draft-db.ts). Nothing reaches
 * the server before it is sealed.
 */
import { useSyncExternalStore } from "react";
import { isEmptyNote } from "@keeplas/export/rich-text";

import type { IconName } from "@/components/icon";
import type { VaultCategory } from "@/crypto/item-meta";
import type { CaptureFile } from "./seal";

export type CaptureKind =
  "scan" | "photo" | "voice" | "video" | "file" | "note";

export interface Draft {
  id: string;
  updatedAt: number;
  kind: CaptureKind;
  title: string;
  note: string;
  category?: VaultCategory;
  /** User-made category; `category` then holds its built-in fallback. */
  categoryId?: string;
  icon?: IconName;
  /** Trusted contacts who can open the item; unset = all of them. */
  contactIds?: string[];
  /** W06-7: the browser waiting for this scan (capture_handoffs). */
  handoffId?: string;
  /** Scanned page images, bound into one PDF when saved. */
  pages: string[];
  files: CaptureFile[];
  sendingEntryId?: string;
}

export interface DraftDb {
  list(userId: string): Promise<Draft[]>;
  put(userId: string, draft: Draft): Promise<void>;
  remove(id: string): Promise<void>;
  removeAll(userId: string): Promise<void>;
}

export interface DraftFiles {
  keep(draftId: string, uri: string): string;
  drop(uri: string): void;
  dropDraft(draftId: string): void;
  dropAll(): void;
}

export const SAVE_DELAY_MS = 400;

export function isEmptyDraft(draft: Draft): boolean {
  return (
    !draft.title.trim() &&
    isEmptyNote(draft.note) &&
    draft.files.length === 0 &&
    draft.pages.length === 0
  );
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const empty = (kind: CaptureKind): Draft => ({
  id: newId(),
  updatedAt: Date.now(),
  kind,
  title: "",
  note: "",
  pages: [],
  files: [],
});

let io: { userId: string; db: DraftDb; files: DraftFiles } | null = null;
let draft: Draft = empty("note");
let saved: Draft[] = [];
let visible: Draft[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  visible = saved.filter((row) => !row.sendingEntryId);
  for (const listener of listeners) listener();
}

function sendingDraft(entryId: string) {
  return saved.find((row) => row.sendingEntryId === entryId);
}

function persist(current: Draft) {
  if (!io) return;
  const { userId, db } = io;
  const others = saved.filter((row) => row.id !== current.id);
  if (isEmptyDraft(current)) {
    saved = others;
    pending = pending.then(() => db.remove(current.id)).catch(() => undefined);
  } else {
    saved = [current, ...others];
    pending = pending
      .then(() => db.put(userId, current))
      .catch(() => undefined);
  }
  emit();
}

function flush() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  persist(draft);
}

function cancelSave() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function change(next: Draft) {
  draft = { ...next, updatedAt: Date.now() };
  emit();
  cancelSave();
  timer = setTimeout(() => {
    timer = null;
    persist(draft);
  }, SAVE_DELAY_MS);
}

function keep(uri: string): string {
  return io ? io.files.keep(draft.id, uri) : uri;
}

function forget(id: string) {
  saved = saved.filter((row) => row.id !== id);
  if (!io) return;
  const { db, files } = io;
  files.dropDraft(id);
  pending = pending.then(() => db.remove(id)).catch(() => undefined);
}

export const draftStore = {
  get: () => draft,
  list: () => visible,
  sendingDraft,
  async attach(userId: string, db: DraftDb, files: DraftFiles) {
    flush();
    io = { userId, db, files };
    saved = (await db.list(userId).catch(() => [])).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    emit();
  },
  start(kind: CaptureKind, patch: Partial<Draft> = {}) {
    flush();
    draft = empty(kind);
    const { files = [], pages = [], ...rest } = patch;
    change({
      ...draft,
      ...rest,
      id: draft.id,
      files: files.map((file) => ({ ...file, uri: keep(file.uri) })),
      pages: pages.map(keep),
    });
  },
  open(id: string): boolean {
    if (draft.id === id) return true;
    const found = saved.find((row) => row.id === id);
    if (!found) return false;
    flush();
    draft = found;
    emit();
    return true;
  },
  update(patch: Partial<Draft>) {
    change({ ...draft, ...patch, id: draft.id });
  },
  addFiles(files: CaptureFile[]) {
    change({
      ...draft,
      files: [
        ...draft.files,
        ...files.map((file) => ({ ...file, uri: keep(file.uri) })),
      ],
    });
  },
  removeFile(uri: string) {
    io?.files.drop(uri);
    change({ ...draft, files: draft.files.filter((f) => f.uri !== uri) });
  },
  addPages(pages: string[]) {
    change({ ...draft, pages: [...draft.pages, ...pages.map(keep)] });
  },
  discard() {
    cancelSave();
    forget(draft.id);
    draft = empty(draft.kind);
    emit();
  },
  remove(id: string) {
    if (draft.id === id) {
      draftStore.discard();
      return;
    }
    forget(id);
    emit();
  },
  reset() {
    cancelSave();
    forget(draft.id);
    draft = empty("note");
    emit();
  },
  markSending(entryId: string) {
    cancelSave();
    persist({ ...draft, sendingEntryId: entryId });
    draft = empty("note");
    emit();
  },
  finishSending(entryId: string) {
    const sent = sendingDraft(entryId);
    if (!sent) return;
    forget(sent.id);
    emit();
  },
  reopenSending(entryId: string): boolean {
    const sent = sendingDraft(entryId);
    if (!sent) return false;
    flush();
    const { sendingEntryId: _, ...reopened } = sent;
    persist(reopened);
    draft = reopened;
    emit();
    return true;
  },
  async detach(userId: string) {
    cancelSave();
    const current = io;
    io = null;
    draft = empty("note");
    saved = [];
    emit();
    if (current?.userId === userId) {
      current.files.dropAll();
      await current.db.removeAll(userId).catch(() => undefined);
    }
  },
  settled: () => pending,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, draftStore.get, draftStore.get);
}

export function useDrafts(): Draft[] {
  return useSyncExternalStore(subscribe, draftStore.list, draftStore.list);
}
