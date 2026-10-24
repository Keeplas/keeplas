# Storage migration (Convex → GCS / S3 / R2)

> **Status: prepared, not started.** Blobs live in Convex file storage today. This page is the checklist for moving them to an object store once the volume calls for it (several TB), without losing a file or breaking an installed app.

## What is stored

- **Vault attachments**: AES-GCM ciphertext, encrypted on the device (web `apps/web/src/lib/upload-queue.tsx`, mobile `apps/mobile/src/features/outbox/`). The IV and the sealed metadata live on the `vault_item_files` row, not in the blob. Moving a blob is a byte-for-byte copy: no key is involved and the server stays zero-access.
- **Avatars**: plain profile images, not vault content.

Storage handles (`StorageRef`) are persisted in:

| Table                 | Field                                          |
| --------------------- | ---------------------------------------------- |
| `vault_item_files`    | `storageId`                                    |
| `vault_item_versions` | `files[].storageId` (history snapshots)        |
| `users`               | `avatarStorageId`                              |
| `storage_blobs`       | `storageRef`: the owner of every attached blob |

Clients hold handles too: the upload response (`{ storageId }`), the mobile outbox (files uploaded before their item is saved, in SQLCipher), and the mobile history screen (it passes a version file's handle back to `getVersionFileUrl`).

## Invariants already in place

1. **One module.** All blob I/O goes through `packages/convex/lib/storage.ts`. `pnpm check:zk` rejects `ctx.storage.*` and any `"_storage"` mention anywhere else, so the schema, the domain code and the clients only know `StorageRef` / `storageRefValidator`.
2. **No stored URLs.** Serving URLs are resolved on read (`getItemFileUrl`, `getVersionFileUrl`, `getMemorialItemFileUrl`, `users.viewer`). Clients treat them as opaque: the web `fetch`es them, the app downloads them, redirects are followed.
3. **Every attached blob has an owner** in `storage_blobs`, bound on first attach (`claimBlob`); rows written before the table existed are bound by `migrations:backfillBlobOwners` (run once per deployment). The table is the inventory the copy job walks, and it stops an account from attaching, then deleting, another account's blob.
4. **Deletion is idempotent and owner-scoped** (`deleteBlob`), which is how an object store's DELETE behaves.

## What changes with an object store

| Concern        | Convex today                                                                                      | Object store                                                                      | What to do                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload         | `generateUploadUrl`, then a POST answered with `{ storageId }`. URL valid 1 h, POST timeout 2 min | The server mints the key and a presigned PUT (or a multipart / resumable session) | Add an "upload ticket" endpoint returning `{ url, method, headers, ref }`. Keep `generateUploadUrl` working until the oldest supported app version uses tickets.                                                                                                                                                                    |
| Size for quota | Read from `_storage` inside the mutation (`getBlobSize`)                                          | A mutation cannot HEAD an object                                                  | Sign the `Content-Length` declared when the ticket is minted and record it on the `storage_blobs` row; `getBlobSize` reads it there.                                                                                                                                                                                                |
| Ownership      | Bound on first attach                                                                             | Known when the ticket is minted                                                   | Insert the `storage_blobs` row with the ticket (pending until attached).                                                                                                                                                                                                                                                            |
| Download URL   | `getUrl`: a bearer URL that never expires, returned by queries                                    | A presigned GET expires (7 days at most)                                          | Never return a presigned URL from a query: results are cached and kept in subscriptions (the memorial screen holds them in `useQuery`). Return a stable URL to an HTTP action (`*.convex.site`) carrying an HMAC token; the action presigns a short-lived GET and answers `302`. Same URL contract for every client, no app update. |
| Delete         | `ctx.storage.delete` inside the mutation                                                          | An HTTP call                                                                      | `deleteBlob` schedules an internal action (`ctx.scheduler.runAfter(0, …)` commits with the mutation). DELETE is idempotent, so retries are safe.                                                                                                                                                                                    |
| Browser        | `connect-src` / `img-src` allow the Convex origin                                                 | Bucket / CDN host, plus `*.convex.site` for the redirect                          | Ship the CSP change (`apps/web/src/lib/security-headers.ts`) **before** the backend hands out new URLs; configure bucket CORS (`PUT`, `GET`, the web origin).                                                                                                                                                                       |

## Plan

Each phase ships on its own and can be rolled back.

1. **Provider code.** Implement the object-store branch inside `lib/storage.ts` against the S3 API (SigV4 signing works with `fetch` + `crypto.subtle` in the Convex runtime, e.g. `aws4fetch`). One implementation covers AWS S3, GCS (XML API with HMAC keys) and Cloudflare R2; R2 also has an official Convex component, `@convex-dev/r2`, and no egress fees. Add the credentials to `.env.example`, then Infisical / `pnpm sync:convex-env`, never to code. Widen `storage_blobs` with an optional location (provider + key); no location means Convex.
2. **Dual read.** Every `lib/storage.ts` function resolves a blob's location from its `storage_blobs` row. Ship and verify with no blob moved.
3. **New uploads to the bucket.** Add the ticket endpoint; the web app and new app versions use it. Older app versions keep uploading to Convex, and phase 4 moves those blobs too.
4. **Copy job.** Walk the `storage_blobs` rows still on Convex a page at a time, in an internal action that is resumable and rate-limited. For each blob:
   - stream it from its Convex URL to the bucket. Convex actions have 64 MiB of memory (512 MiB in Node), so large files go through ranged / multipart copies or an external worker (Cloud Run, Lambda);
   - check the copy against `_storage.sha256` (hex; S3's `x-amz-checksum-sha256` takes base64; GCS only offers MD5 / CRC32C, so re-hash the copy);
   - record the new location in a mutation, only if the row still exists (a blob deleted in the meantime is deleted from the bucket instead). Keep the Convex copy.
5. **Verify.** Every row has a location; counts and bytes match the bucket inventory; a sample of files opens on a real client (decryption checks the AES-GCM tag end to end).
6. **Retire the Convex copies** after a grace period of at least 30 days and at least the Convex backup retention. Until then, rolling back means clearing locations. Then remove the Convex branch and, once no supported app version calls it, `generateUploadUrl`.

## Durability checklist

- Bucket versioning or soft delete on, with a retention at least as long as the Convex backup retention: restoring a database backup must not bring back rows whose blobs are gone.
- Public access blocked: blobs are only reachable through presigned URLs. Server-side encryption on as defence in depth (blobs are already ciphertext).
- Region picked for data residency, dual- or multi-region for a product whose files must outlive their owner.
- Never delete a source before its copy is verified.
- An account deleted during the move loses both copies (`deleteBlob` follows the location).

## Before the volume grows

- **Orphans.** A blob uploaded but never attached (cancelled save, quota refusal, app killed before the outbox saves) has no `storage_blobs` row, is not counted in the quota and stays in storage. Sweep `_storage` for blobs without an owner after a delay longer than the mobile outbox may take to save (it reuses uploaded handles on retry), or make the outbox upload again when a handle is refused. With tickets, pending rows expire on their own (plus a bucket lifecycle rule).
- **Whole-table reads.** `admin/vault.ts` `storageStats` and `vault_items.countPlaintextMetadata` read every `vault_item_files` row in one transaction, and Convex caps a transaction at 32,000 documents / 16 MiB. Replace them with counters (or `@convex-dev/aggregate`) well before the file count gets there.
- **Per-user quota.** `getStorageUsage` reads all of a user's files and version snapshots on every upload. A counter kept on attach / delete makes it constant-time.
- **Large files.** The Convex upload POST times out after 2 minutes, so a mobile video is bounded by the uplink speed. Multipart (S3) or resumable (GCS) uploads lift that limit.
