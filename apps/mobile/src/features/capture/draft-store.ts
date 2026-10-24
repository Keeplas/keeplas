/**
 * The capture being prepared, shared by the capture screens (M07-2 scan,
 * M07-3 voice, M07-7 / M07-8 compose, M07-4 securing). Plaintext stays in
 * memory and in the app's own cache folder until it is sealed; `reset`
 * drops it once the outbox holds the encrypted copy.
 */
import { useSyncExternalStore } from "react";

import type { IconName } from "@/components/icon";
import type { VaultCategory } from "@/crypto/item-meta";
import type { CaptureFile } from "./seal";

export type CaptureKind =
  "scan" | "photo" | "voice" | "video" | "file" | "note";

export interface Draft {
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
}

const empty = (kind: CaptureKind): Draft => ({
  kind,
  title: "",
  note: "",
  pages: [],
  files: [],
});

let draft: Draft = empty("note");
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const draftStore = {
  get: () => draft,
  start(kind: CaptureKind, patch: Partial<Draft> = {}) {
    draft = { ...empty(kind), ...patch };
    emit();
  },
  update(patch: Partial<Draft>) {
    draft = { ...draft, ...patch };
    emit();
  },
  addFiles(files: CaptureFile[]) {
    draft = { ...draft, files: [...draft.files, ...files] };
    emit();
  },
  removeFile(uri: string) {
    draft = { ...draft, files: draft.files.filter((f) => f.uri !== uri) };
    emit();
  },
  addPages(pages: string[]) {
    draft = { ...draft, pages: [...draft.pages, ...pages] };
    emit();
  },
  reset() {
    draft = empty("note");
    emit();
  },
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
