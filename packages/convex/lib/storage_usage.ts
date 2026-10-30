/**
 * Storage usage accounting against the plan quota (lib/plans.ts).
 *
 * The quota counts everything an owner stores: item rows (sealed content,
 * title, metadata, owner wrap), the edit history (`vault_item_versions`),
 * the recipient-key rows they create, and file blobs (size buckets). Items
 * shared with them by other people never count: those rows belong to the
 * sharer.
 *
 * Reading every item and version to sum it would exceed the Convex read
 * limits as history grows (a version can be ~1 MiB), so each owner has one
 * `storage_usage` row that every write keeps in step:
 *   - active  = non-archived items (row + files) + all recipient keys
 *   - archive = archived items (row + files) + history (version rows + blobs
 *               left only in the history, one count per blob and item)
 * A file row is only ever deleted after a version snapshot took it, so its
 * blob moves to "archive" then (see the item writes in vault_items.ts).
 *
 * Accounts that predate the counter get it built by
 * `migrations.backfillStorageUsage`, or on their first quota-checked write.
 * Until it is complete, usage falls back to the account's attachments (a
 * lower bound, so nobody is refused wrongly) — see {@link readStorageUsage}.
 */

import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./plans";
import { storedFileBytes } from "./storage";

/** Ids, timestamps, enums and short arrays of a row, on top of its strings. */
const ROW_OVERHEAD_BYTES = 128;

const encoder = new TextEncoder();

function textBytes(...values: (string | undefined)[]): number {
  let bytes = 0;
  for (const value of values) {
    if (value) bytes += encoder.encode(value).length;
  }
  return bytes;
}

type ItemStrings = Pick<
  Doc<"vault_items">,
  | "title"
  | "encryptedTitle"
  | "encryptedContent"
  | "encryptedMeta"
  | "encryptedLinks"
  | "ownerWrappedDek"
>;

/** Bytes an item row stores. */
export function itemBytes(item: ItemStrings): number {
  return (
    ROW_OVERHEAD_BYTES +
    textBytes(
      item.title,
      item.encryptedTitle,
      item.encryptedContent,
      item.encryptedMeta,
      item.encryptedLinks,
      item.ownerWrappedDek,
    )
  );
}

/** What an item row counts for in its owner's usage right now. */
export function countedItemBytes(item: Doc<"vault_items">): number {
  return item.storedBytes ?? itemBytes(item);
}

/** Bytes a version row stores (its blobs are counted apart). */
export function versionBytes(
  version: Pick<
    Doc<"vault_item_versions">,
    | "encryptedTitle"
    | "encryptedContent"
    | "encryptedMeta"
    | "encryptedLinks"
    | "files"
  >,
): number {
  return (
    ROW_OVERHEAD_BYTES +
    textBytes(
      version.encryptedTitle,
      version.encryptedContent,
      version.encryptedMeta,
      version.encryptedLinks,
    ) +
    version.files.reduce(
      (sum, file) =>
        sum + textBytes(file.storageId, file.iv, file.encryptedMeta),
      0,
    )
  );
}

/** Bytes a recipient-key row stores. */
export function recipientKeyBytes(row: { wrappedDek: string }): number {
  return ROW_OVERHEAD_BYTES + textBytes(row.wrappedDek);
}

export function keysBytes(rows: { wrappedDek: string }[]): number {
  return rows.reduce((sum, row) => sum + recipientKeyBytes(row), 0);
}

export function filesBytes(files: { sizeBucket?: number; size?: number }[]) {
  return files.reduce((sum, file) => sum + storedFileBytes(file), 0);
}

export type Bucket = "activeBytes" | "archiveBytes";
export type UsageDelta = Partial<Record<Bucket, number>>;

/** Where an item's row and files count. */
export function bucketOf(item: Pick<Doc<"vault_items">, "status">): Bucket {
  return item.status === "archived" ? "archiveBytes" : "activeBytes";
}

function usageRow(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("storage_usage")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

const RESTARTED_BACKFILL = { activeBytes: 0, archiveBytes: 0, backfill: {} };

/**
 * Apply a write's effect to the owner's counter. Without a counter it is a
 * no-op: the build reads the current rows. A build in progress restarts, as
 * the rows it already read may just have changed.
 */
export async function adjustStorageUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
  delta: UsageDelta,
): Promise<void> {
  const active = delta.activeBytes ?? 0;
  const archive = delta.archiveBytes ?? 0;
  if (active === 0 && archive === 0) return;
  const row = await usageRow(ctx, userId);
  if (!row) return;
  if (row.backfill) {
    await ctx.db.patch(row._id, RESTARTED_BACKFILL);
    return;
  }
  await ctx.db.patch(row._id, {
    activeBytes: row.activeBytes + active,
    archiveBytes: row.archiveBytes + archive,
  });
}

/** Count `bytes` in `to` instead of `from`. */
export function moveStorageUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
  bytes: number,
  from: Bucket,
  to: Bucket,
): Promise<void> {
  if (from === to) return Promise.resolve();
  return adjustStorageUsage(ctx, userId, { [from]: -bytes, [to]: bytes });
}

/**
 * Patch an item and keep its byte count in step: stamps `storedBytes` and
 * moves the difference into the bucket of its (possibly new) status.
 */
export async function patchCountedItem(
  ctx: MutationCtx,
  item: Doc<"vault_items">,
  fields: Partial<Doc<"vault_items">>,
): Promise<void> {
  const next = { ...item, ...fields };
  const storedBytes = itemBytes(next);
  await ctx.db.patch(item._id, { ...fields, storedBytes });
  const delta: UsageDelta = { [bucketOf(item)]: -countedItemBytes(item) };
  delta[bucketOf(next)] = (delta[bucketOf(next)] ?? 0) + storedBytes;
  await adjustStorageUsage(ctx, item.userId, delta);
}

/** Delete recipient-key rows of `ownerId`'s items. */
export async function deleteRecipientKeys(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  rows: Doc<"vault_item_recipient_keys">[],
): Promise<void> {
  for (const row of rows) await ctx.db.delete(row._id);
  await adjustStorageUsage(ctx, ownerId, { activeBytes: -keysBytes(rows) });
}

/**
 * The owner's usage. Until their counter is complete (an account that
 * predates it, mid-build), only the attachments: small rows, a lower bound,
 * so the quota never refuses anyone wrongly in the meantime.
 */
export async function readStorageUsage(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{ activeBytes: number; archiveBytes: number }> {
  const row = await usageRow(ctx, userId);
  if (row && !row.backfill) return row;
  const files = await ctx.db
    .query("vault_item_files")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return { activeBytes: filesBytes(files), archiveBytes: 0 };
}

/**
 * Bytes read inline by the first quota-checked write of an account with no
 * counter: a typical account is built at once, a large one continues in the
 * background (BACKFILL_STEP_BYTES per scheduled step).
 */
const INLINE_BACKFILL_BYTES = 1024 * 1024;
export const BACKFILL_STEP_BYTES = 6 * 1024 * 1024;
/** Versions read at a time (each up to ~1 MiB). */
const VERSIONS_PER_READ = 4;

/**
 * Reject a write that grows usage by `growth` bytes past the owner's plan
 * quota (Free 100 MB / Lifetime 10 GB). Throws
 * `ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" })` (a ConvexError survives
 * production redaction), which the clients map to an upgrade prompt. A write
 * that doesn't grow usage always passes, even over quota. Call it before the
 * write: an account without a counter starts building it here, from the
 * rows as they are.
 */
export async function assertWithinStorageQuota(
  ctx: MutationCtx,
  userId: Id<"users">,
  growth: number,
): Promise<void> {
  if (growth <= 0) return;
  if (!(await usageRow(ctx, userId))) {
    await startStorageBackfill(ctx, userId, INLINE_BACKFILL_BYTES);
  }
  const { activeBytes, archiveBytes } = await readStorageUsage(ctx, userId);
  const user = await ctx.db.get(userId);
  const quota = PLAN_QUOTA_BYTES[getUserPlan(user ?? { plan: undefined })];
  if (activeBytes + archiveBytes + growth > quota) {
    throw new ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" });
  }
}

/**
 * Create the counter of an account that has none and build it: inline up to
 * `inlineBytes` read, the rest in scheduled steps.
 */
export async function startStorageBackfill(
  ctx: MutationCtx,
  userId: Id<"users">,
  inlineBytes: number,
): Promise<void> {
  const rowId = await ctx.db.insert("storage_usage", {
    userId,
    ...RESTARTED_BACKFILL,
  });
  if (!(await advanceStorageBackfill(ctx, rowId, inlineBytes))) {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.backfillStorageUsageStep,
      { userId },
    );
  }
}

/**
 * Count the next items (row, files, keys) and versions of a counter being
 * built, until about `budgetBytes` were read. Item by item, so a blob is
 * counted once per item: where its live row is, else in the history.
 * Returns true once the counter is complete.
 */
export async function advanceStorageBackfill(
  ctx: MutationCtx,
  rowId: Id<"storage_usage">,
  budgetBytes: number,
): Promise<boolean> {
  const row = await ctx.db.get(rowId);
  if (!row?.backfill) return true;
  const usage = {
    activeBytes: row.activeBytes,
    archiveBytes: row.archiveBytes,
  };
  let { afterItem, item } = row.backfill;
  let read = 0;
  while (read < budgetBytes) {
    if (!item) {
      const next = await ctx.db
        .query("vault_items")
        .withIndex("by_user", (q) =>
          q.eq("userId", row.userId).gt("_creationTime", afterItem ?? 0),
        )
        .first();
      if (!next) {
        await ctx.db.patch(rowId, { ...usage, backfill: undefined });
        return true;
      }
      const files = await ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", next._id))
        .collect();
      const keys = await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", next._id))
        .collect();
      usage[bucketOf(next)] += countedItemBytes(next) + filesBytes(files);
      usage.activeBytes += keysBytes(keys);
      read += countedItemBytes(next);
      afterItem = next._creationTime;
      item = { id: next._id, seen: files.map((file) => file.storageId) };
      continue;
    }
    const current = item;
    const versions = await ctx.db
      .query("vault_item_versions")
      .withIndex("by_item", (q) =>
        q
          .eq("itemId", current.id)
          .gt("_creationTime", current.afterVersion ?? 0),
      )
      .take(VERSIONS_PER_READ);
    const seen = new Set(current.seen);
    for (const version of versions) {
      usage.archiveBytes += versionBytes(version);
      read += versionBytes(version);
      for (const file of version.files) {
        if (seen.has(file.storageId)) continue;
        seen.add(file.storageId);
        usage.archiveBytes += storedFileBytes(file);
      }
    }
    item =
      versions.length < VERSIONS_PER_READ
        ? undefined
        : {
            id: current.id,
            afterVersion: versions[versions.length - 1]._creationTime,
            seen: [...seen],
          };
  }
  await ctx.db.patch(rowId, { ...usage, backfill: { afterItem, item } });
  return false;
}

/** One scheduled build step; schedules the next until the counter is done. */
export async function continueStorageBackfill(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const row = await usageRow(ctx, userId);
  if (!row?.backfill) return;
  if (!(await advanceStorageBackfill(ctx, row._id, BACKFILL_STEP_BYTES))) {
    await ctx.scheduler.runAfter(
      0,
      internal.migrations.backfillStorageUsageStep,
      { userId },
    );
  }
}

/** Whether the owner already has a counter (complete or being built). */
export async function hasStorageUsage(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<boolean> {
  return (await usageRow(ctx, userId)) !== null;
}
