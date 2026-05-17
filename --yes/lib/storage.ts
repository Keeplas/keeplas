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
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type StorageRef = Id<"_storage">;

export const storageRefValidator = v.id("_storage");

export async function generateBlobUploadUrl(ctx: MutationCtx): Promise<string> {
  return ctx.storage.generateUploadUrl();
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
