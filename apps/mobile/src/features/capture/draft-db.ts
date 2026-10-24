import { Directory, File, Paths } from "expo-file-system";

import { secureDb } from "@/lib/secure-db";
import type { Draft, DraftDb, DraftFiles } from "./draft-store";

export const sqliteDraftDb: DraftDb = {
  async list(userId) {
    const { rows } = await (
      await secureDb()
    ).execute("SELECT body FROM capture_drafts WHERE user_id = ?", [userId]);
    return rows.map((row) => JSON.parse(String(row.body)) as Draft);
  },
  async put(userId, draft) {
    await (
      await secureDb()
    ).execute(
      "INSERT OR REPLACE INTO capture_drafts (id, user_id, updated_at, body) VALUES (?, ?, ?, ?)",
      [draft.id, userId, draft.updatedAt, JSON.stringify(draft)],
    );
  },
  async remove(id) {
    await (
      await secureDb()
    ).execute("DELETE FROM capture_drafts WHERE id = ?", [id]);
  },
  async removeAll(userId) {
    await (
      await secureDb()
    ).execute("DELETE FROM capture_drafts WHERE user_id = ?", [userId]);
  },
};

const root = () => new Directory(Paths.document, "drafts");

function draftFolder(draftId: string): Directory {
  const dir = new Directory(root(), draftId);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export const deviceDraftFiles: DraftFiles = {
  keep(draftId, uri) {
    const folder = draftFolder(draftId);
    if (uri.startsWith(folder.uri)) return uri;
    const source = new File(uri);
    if (!source.exists) return uri;
    const name = `${Date.now().toString(36)}-${source.name}`;
    const target = new File(folder, name);
    try {
      source.move(target);
    } catch {
      source.copy(target);
    }
    return target.uri;
  },
  drop(uri) {
    const file = new File(uri);
    if (file.uri.startsWith(root().uri) && file.exists) file.delete();
  },
  dropDraft(draftId) {
    const dir = new Directory(root(), draftId);
    if (dir.exists) dir.delete();
  },
  dropAll() {
    const dir = root();
    if (dir.exists) dir.delete();
  },
};
