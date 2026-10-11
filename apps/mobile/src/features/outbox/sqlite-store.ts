/**
 * Outbox persistence in SQLCipher (op-sqlite built with `"sqlcipher": true`,
 * see package.json). The database key is 32 random bytes kept in the
 * Keychain / Keystore (this device only). Rows already hold only ciphertext
 * (see outbox.ts); SQLCipher adds a second layer for the queue itself.
 */
import { open, type DB } from "@op-engineering/op-sqlite";
import * as SecureStore from "expo-secure-store";
import { uint8ToHex } from "@keeplas/crypto/encoding";

import { randomBytes } from "@/crypto/envelope";
import type { OutboxEntry, OutboxStore } from "./outbox";

const KEY_NAME = "keeplas.outbox.dbkey";
const LOCAL: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function databaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, LOCAL);
  if (existing) return existing;
  const key = uint8ToHex(randomBytes(32));
  await SecureStore.setItemAsync(KEY_NAME, key, LOCAL);
  return key;
}

let database: Promise<DB> | null = null;

function db(): Promise<DB> {
  database ??= databaseKey().then(async (encryptionKey) => {
    const handle = open({ name: "keeplas-outbox.sqlite", encryptionKey });
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        body TEXT NOT NULL
      )`,
    );
    return handle;
  });
  return database;
}

export const sqliteStore: OutboxStore = {
  async list(userId) {
    const { rows } = await (
      await db()
    ).execute("SELECT body FROM outbox WHERE user_id = ? ORDER BY created_at", [
      userId,
    ]);
    return rows.map((row) => JSON.parse(String(row.body)) as OutboxEntry);
  },
  async put(entry) {
    await (
      await db()
    ).execute(
      "INSERT OR REPLACE INTO outbox (id, user_id, created_at, body) VALUES (?, ?, ?, ?)",
      [entry.id, entry.userId, entry.createdAt, JSON.stringify(entry)],
    );
  },
  async remove(id) {
    await (await db()).execute("DELETE FROM outbox WHERE id = ?", [id]);
  },
};
