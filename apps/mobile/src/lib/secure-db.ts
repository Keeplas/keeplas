/**
 * The device's encrypted SQLite database (op-sqlite built with
 * `"sqlcipher": true`, see package.json). The database key is 32 random
 * bytes in the device store: this phone only, and readable only while it
 * is unlocked, so a locked phone does not give it away (once opened, the
 * database stays open until the app quits). Holds the capture outbox, the
 * vault summary cache and the capture drafts.
 *
 * The file keeps its historical "outbox" name so existing installs reopen
 * their queue.
 */
import { open, type DB } from "@op-engineering/op-sqlite";
import { uint8ToHex } from "@keeplas/crypto/encoding";

import { randomBytes } from "@/crypto/envelope";
import { deviceStore } from "./device-store";

const KEY_NAME = "keeplas.outbox.dbkey";

async function databaseKey(): Promise<string> {
  const existing = deviceStore.getItem(KEY_NAME);
  if (existing) return existing;
  const key = uint8ToHex(randomBytes(32));
  deviceStore.setItem(KEY_NAME, key);
  return key;
}

let database: Promise<DB> | null = null;

export function secureDb(): Promise<DB> {
  if (database) return database;
  database = databaseKey().then(async (encryptionKey) => {
    const handle = open({ name: "keeplas-outbox.sqlite", encryptionKey });
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        body TEXT NOT NULL
      )`,
    );
    await handle.execute("DROP TABLE IF EXISTS item_summaries");
    await handle.execute("DROP TABLE IF EXISTS item_summaries_v2");
    await handle.execute("DROP TABLE IF EXISTS item_summaries_v3");
    await handle.execute("DROP TABLE IF EXISTS item_summaries_v4");
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS item_summaries_v5 (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        category_id TEXT,
        kind TEXT NOT NULL,
        icon TEXT,
        attachments INTEGER NOT NULL,
        duration_sec REAL,
        folder_id TEXT,
        shared_with TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS capture_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        body TEXT NOT NULL
      )`,
    );
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS form_drafts (
        key TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        body TEXT NOT NULL
      )`,
    );
    return handle;
  });
  // The key cannot be read while the phone is locked: try again next call.
  database.catch(() => {
    database = null;
  });
  return database;
}
