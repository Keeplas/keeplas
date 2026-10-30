import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import ReactNativeBlobUtil from "react-native-blob-util";

import type { FormDraftDb } from "@/lib/form-drafts";
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

/**
 * Draft files are not sealed yet, so they stay out of backups. iOS backs up
 * Documents (iCloud, computer backups): flag the drafts folder, each time a
 * file goes in (the folder is remade after a sign-out) and at sign-in for a
 * folder an older version made. Android already backs up nothing but
 * shared preferences (expo-secure-store's backup rules, app.json).
 */
export function keepDraftsOutOfBackups(): void {
  const dir = root();
  if (Platform.OS !== "ios" || !dir.exists) return;
  ReactNativeBlobUtil.ios
    .excludeFromBackupKey(dir.uri.replace(/^file:\/\//, ""))
    .catch(() => undefined);
}

function draftFolder(draftId: string): Directory {
  const dir = new Directory(root(), draftId);
  if (!dir.exists) dir.create({ intermediates: true });
  keepDraftsOutOfBackups();
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

export const sqliteFormDraftDb: FormDraftDb = {
  async list(userId) {
    const { rows } = await (
      await secureDb()
    ).execute("SELECT key, body FROM form_drafts WHERE user_id = ?", [userId]);
    return rows.map((row) => ({
      key: String(row.key),
      value: JSON.parse(String(row.body)) as unknown,
    }));
  },
  async put(userId, key, value) {
    await (
      await secureDb()
    ).execute(
      "INSERT OR REPLACE INTO form_drafts (key, user_id, updated_at, body) VALUES (?, ?, ?, ?)",
      [key, userId, Date.now(), JSON.stringify(value)],
    );
  },
  async remove(key) {
    await (
      await secureDb()
    ).execute("DELETE FROM form_drafts WHERE key = ?", [key]);
  },
  async removeAll(userId) {
    await (
      await secureDb()
    ).execute("DELETE FROM form_drafts WHERE user_id = ?", [userId]);
  },
};
