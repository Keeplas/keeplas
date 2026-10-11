-- Local SQLite on the mobile app (Expo + op-sqlite with SQLCipher). Draft.
-- Everything sensitive is already ciphertext from @keeplas/crypto; SQLCipher adds disk encryption.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,                 -- 'schema_version', 'user_id', 'last_sync_at'
  value TEXT NOT NULL
);

-- Mirror of vault_items, ciphertext only, for offline reading.
CREATE TABLE IF NOT EXISTS items (
  id                 TEXT PRIMARY KEY,    -- Convex _id
  owner_wrapped_dek  TEXT NOT NULL,       -- ML-KEM envelope
  encrypted_title    TEXT,
  encrypted_content  TEXT NOT NULL,
  encrypted_meta     TEXT,                -- category, tags (after F4)
  status             TEXT NOT NULL,
  updated_at         INTEGER NOT NULL,
  synced_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);

-- Encrypted attachments cached on disk.
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  local_path  TEXT NOT NULL,              -- ciphertext file in the app sandbox
  iv          TEXT NOT NULL,
  size_bucket INTEGER NOT NULL
);

-- Offline capture queue (designs M07-4: 'Securing your item').
CREATE TABLE IF NOT EXISTS outbox (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('create_item', 'add_file', 'update_item', 'delete_item')),
  payload       TEXT NOT NULL,            -- JSON of ciphertext fields only
  local_file    TEXT,                     -- encrypted file waiting for upload
  state         TEXT NOT NULL DEFAULT 'encrypted' CHECK (state IN ('encrypted', 'uploading', 'committed', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_state ON outbox(state, created_at);

-- Local search over decrypted titles: rebuilt after unlock, wiped on lock.
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(item_id UNINDEXED, title);
