/**
 * Storage abstraction layer for encrypted blob persistence.
 *
 * All ciphertext blob I/O MUST go through this module. Direct calls to
 * `ctx.storage.*` outside this file are prohibited so that swapping the
 * underlying provider (e.g. Convex Storage → S3 / GCS) requires changes
 * here only, never in business logic. `pnpm check:zk` enforces it, and
 * docs/STORAGE_MIGRATION.md is the plan for that swap.
 *
 * The `StorageRef` type is the opaque handle persisted on `vault_item_files`
 * rows and ferried by the upload client. Today it is a Convex storage id;
 * tomorrow it can become a string (object key) without consumers noticing.
 */

import { v } from "convex/values";
import type { StorageActionWriter } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { enforceIpRateLimit } from "./rate_limit";

export type StorageRef = Id<"_storage">;

export const storageRefValidator = v.id("_storage");

/**
 * Upload URLs one account may request per hour, vault files and avatar
 * together. A blob counts toward no quota until it is attached, so this
 * bounds how fast an account can park unattached blobs before the sweep.
 */
export const UPLOAD_URLS_PER_HOUR = 200;

/**
 * How long an uploaded blob may wait to be attached. The upload clients
 * attach right after uploading, and the mobile outbox uploads again when an
 * attach fails later than this. Past it, an unowned blob can no longer be
 * claimed or discarded by an account, and the daily sweep deletes it.
 */
export const UNCLAIMED_BLOB_TTL_MS = 24 * 60 * 60 * 1000;

export async function generateBlobUploadUrl(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string> {
  await enforceIpRateLimit(ctx, "upload_url", userId, UPLOAD_URLS_PER_HOUR);
  return ctx.storage.generateUploadUrl();
}

/**
 * Store a Blob directly and return its handle. Only the action / HTTP-action
 * storage writer exposes `store()` — mutations stream ciphertext from the
 * client via {@link generateBlobUploadUrl}. This is the wrapper's store half,
 * used to seed blobs (e.g. test fixtures) without bypassing the abstraction.
 */
export async function storeBlob(
  storage: StorageActionWriter,
  blob: Blob,
): Promise<StorageRef> {
  return storage.store(blob);
}

export async function getBlobDownloadUrl(
  ctx: QueryCtx | MutationCtx,
  ref: StorageRef,
): Promise<string | null> {
  return ctx.storage.getUrl(ref);
}

function blobOwner(ctx: MutationCtx, ref: StorageRef) {
  return ctx.db
    .query("storage_blobs")
    .withIndex("by_storage_ref", (q) => q.eq("storageRef", ref))
    .unique();
}

/**
 * Bind a blob to the account attaching it, on first use. Returns false when
 * it is bound to another account: a handle is not a secret (a released
 * contact sees the file rows of the items left to them), so it must never
 * let someone else attach the blob — and later delete it.
 */
export async function claimBlob(
  ctx: MutationCtx,
  ref: StorageRef,
  userId: Id<"users">,
): Promise<boolean> {
  const owner = await blobOwner(ctx, ref);
  if (owner) return owner.userId === userId;
  await ctx.db.insert("storage_blobs", {
    storageRef: ref,
    userId,
    createdAt: Date.now(),
  });
  return true;
}

/** A blob uploaded within the upload window (UNCLAIMED_BLOB_TTL_MS). */
async function isFreshUpload(ctx: MutationCtx, ref: StorageRef) {
  const blob = await ctx.db.system.get(ref);
  return (
    blob !== null && blob._creationTime > Date.now() - UNCLAIMED_BLOB_TTL_MS
  );
}

/**
 * {@link claimBlob} for a blob the account has just uploaded. An unowned
 * blob older than the upload window is refused: it predates owner binding (a
 * legacy attachment whose handle a released contact may know), so attaching
 * it would hand someone else's file to this account.
 */
export async function claimUpload(
  ctx: MutationCtx,
  ref: StorageRef,
  userId: Id<"users">,
): Promise<boolean> {
  if (!(await blobOwner(ctx, ref)) && !(await isFreshUpload(ctx, ref))) {
    return false;
  }
  return await claimBlob(ctx, ref, userId);
}

/**
 * Delete one of the account's blobs. Idempotent, as on an object store (a
 * blob already gone is a no-op), and a blob bound to another account is left
 * alone: wiping one's own rows never removes someone else's file.
 */
export async function deleteBlob(
  ctx: MutationCtx,
  ref: StorageRef,
  userId: Id<"users">,
): Promise<void> {
  const owner = await blobOwner(ctx, ref);
  if (owner && owner.userId !== userId) return;
  if (await ctx.db.system.get(ref)) await ctx.storage.delete(ref);
  if (owner) await ctx.db.delete(owner._id);
}

/**
 * Delete an upload the account could not attach. Only a fresh, unowned blob
 * qualifies: an older unowned one may be a legacy attachment (see
 * {@link claimUpload}).
 */
export async function discardUnclaimedBlob(
  ctx: MutationCtx,
  ref: StorageRef,
): Promise<boolean> {
  if (await blobOwner(ctx, ref)) return false;
  if (!(await isFreshUpload(ctx, ref))) return false;
  await ctx.storage.delete(ref);
  return true;
}

const SWEEP_BATCH = 100;
// A week of daily runs sees each expired blob, so a failed run loses nothing.
const SWEEP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Delete one batch of blobs nobody attached within the upload window. Only
 * blobs uploaded after the first owner row are looked at: an older blob with
 * no owner row can be a legacy attachment still held by a file row
 * (migrations.backfillBlobOwners binds those). Returns the creation time to
 * resume after, or null once the window is done.
 */
export async function sweepUnclaimedBlobs(
  ctx: MutationCtx,
  after = 0,
): Promise<number | null> {
  const firstOwner = await ctx.db.query("storage_blobs").order("asc").first();
  if (!firstOwner) return null;
  const now = Date.now();
  const from = Math.max(
    after,
    firstOwner._creationTime,
    now - SWEEP_LOOKBACK_MS,
  );
  const blobs = await ctx.db.system
    .query("_storage")
    .withIndex("by_creation_time", (q) =>
      q
        .gt("_creationTime", from)
        .lt("_creationTime", now - UNCLAIMED_BLOB_TTL_MS),
    )
    .take(SWEEP_BATCH);
  for (const blob of blobs) {
    if (!(await blobOwner(ctx, blob._id))) await ctx.storage.delete(blob._id);
  }
  return blobs.length === SWEEP_BATCH
    ? blobs[blobs.length - 1]._creationTime
    : null;
}

/** Delete every stored blob — full deployment wipe only. Returns the count. */
export async function deleteAllBlobs(ctx: MutationCtx): Promise<number> {
  const blobs = await ctx.db.system.query("_storage").collect();
  for (const blob of blobs) await ctx.storage.delete(blob._id);
  return blobs.length;
}

/** Exact size of a stored (ciphertext) blob, from Convex's storage table. */
export async function getBlobSize(
  ctx: QueryCtx | MutationCtx,
  ref: StorageRef,
): Promise<number | null> {
  return (await ctx.db.system.get(ref))?.size ?? null;
}

const MIN_BUCKET = 4096;

/**
 * Round a byte size up to a bucket (F4): 16 steps per power of two, so the
 * row never carries the exact size while the quota overcounts by ≤ 6.25 %.
 */
export function sizeBucket(bytes: number): number {
  if (bytes <= MIN_BUCKET) return MIN_BUCKET;
  const step = 2 ** Math.max(Math.floor(Math.log2(bytes)) - 4, 0);
  return Math.ceil(bytes / step) * step;
}

/** Bytes a file counts for: its bucket, or the legacy plaintext size. */
export function storedFileBytes(file: {
  sizeBucket?: number;
  size?: number;
}): number {
  return file.sizeBucket ?? file.size ?? 0;
}
