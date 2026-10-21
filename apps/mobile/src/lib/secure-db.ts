/**
 * The device's encrypted SQLite database (op-sqlite built with
 * `"sqlcipher": true`, see package.json). The database key is 32 random
 * bytes kept in the Keychain / Keystore (this device only). Holds the
 * capture outbox and the vault summary cache.
 *
 * The file keeps its historical "outbox" name so existing installs reopen
 * their queue.
 */
import { open, type DB } from "@op-engineering/op-sqlite";
import * as SecureStore from "expo-secure-store";
import { uint8ToHex } from "@keeplas/crypto/encoding";

import { randomBytes } from "@/crypto/envelope";

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

export function secureDb(): Promise<DB> {
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
    await handle.execute("DROP TABLE IF EXISTS item_summaries");
    await handle.execute("DROP TABLE IF EXISTS item_summaries_v2");
    await handle.execute("DROP TABLE IF EXISTS item_summaries_v3");
    await handle.execute(
      `CREATE TABLE IF NOT EXISTS item_summaries_v4 (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
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
    return handle;
  });
  return database;
}
