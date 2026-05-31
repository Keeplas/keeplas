/**
 * Storage abstraction layer for encrypted blob persistence.
 *
 * All ciphertext blob I/O MUST go through this module. Direct calls to
 * `ctx.storage.*` outside this file are prohibited so that swapping the
 * underlying provider (e.g. Convex Storage → S3 / GCS) requires changes
 * here only, never in business logic.
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

export async function deleteBlob(
  ctx: MutationCtx,
  ref: StorageRef,
): Promise<void> {
  await ctx.storage.delete(ref);
}
