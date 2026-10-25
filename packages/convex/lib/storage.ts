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

export type StorageRef = Id<"_storage">;

export const storageRefValidator = v.id("_storage");

export async function generateBlobUploadUrl(ctx: MutationCtx): Promise<string> {
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

export async function discardUnclaimedBlob(
  ctx: MutationCtx,
  ref: StorageRef,
): Promise<boolean> {
  if (await blobOwner(ctx, ref)) return false;
  if (!(await ctx.db.system.get(ref))) return false;
  await ctx.storage.delete(ref);
  return true;
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
