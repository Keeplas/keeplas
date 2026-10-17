/**
 * Outbox persistence in the device's SQLCipher database (see lib/secure-db).
 * Rows already hold only ciphertext (see outbox.ts); SQLCipher adds a second
 * layer for the queue itself.
 */
import { secureDb } from "@/lib/secure-db";
import type { OutboxEntry, OutboxStore } from "./outbox";

export const sqliteStore: OutboxStore = {
  async list(userId) {
    const { rows } = await (
      await secureDb()
    ).execute("SELECT body FROM outbox WHERE user_id = ? ORDER BY created_at", [
      userId,
    ]);
    return rows.map((row) => JSON.parse(String(row.body)) as OutboxEntry);
  },
  async put(entry) {
    await (
      await secureDb()
    ).execute(
      "INSERT OR REPLACE INTO outbox (id, user_id, created_at, body) VALUES (?, ?, ?, ?)",
      [entry.id, entry.userId, entry.createdAt, JSON.stringify(entry)],
    );
  },
  async remove(id) {
    await (await secureDb()).execute("DELETE FROM outbox WHERE id = ?", [id]);
  },
};
