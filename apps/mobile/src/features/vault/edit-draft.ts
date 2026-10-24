import type { Id } from "@keeplas/backend/_generated/dataModel";
import { parseNote } from "@keeplas/export/rich-text";

import type { CaptureFile } from "@/features/capture/seal";

export interface EditDraft {
  title: string;
  note: string;
  removed: Id<"vault_item_files">[];
  added: CaptureFile[];
}

export const editDraftKey = (itemId: string) => `edit:${itemId}`;

export const editFilesFolder = (itemId: string) => `edit-${itemId}`;

export function sameNote(a: string, b: string): boolean {
  return JSON.stringify(parseNote(a)) === JSON.stringify(parseNote(b));
}

export function hasEditChanges(
  draft: EditDraft | undefined,
  saved: { title: string; note: string },
): boolean {
  if (!draft) return false;
  return (
    draft.title.trim() !== saved.title.trim() ||
    !sameNote(draft.note, saved.note) ||
    draft.removed.length > 0 ||
    draft.added.length > 0
  );
}
