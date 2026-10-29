import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  getActiveVaultFiles,
  getStorageUsage,
} from "./helpers";
import { createAuditLog } from "./audit";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./lib/plans";
import { sizeBucket, storedFileBytes } from "./lib/storage";

/**
 * Get or create the user's vault. A plain mutation, not `auditedMutation`:
 * clients call it before every upload, and installed apps send no `_audit`.
 * Only an actual creation is a state change, so only it writes the entry.
 */
export const getOrCreateVault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const existing = await getUserVault(ctx, userId);
    if (existing) return existing._id;

    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "vault.created",
      resourceType: "vault",
      resourceId: vaultId,
    });
    return vaultId;
  },
});

/**
 * Get the current user's vault.
 */
export const getVault = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    return await getUserVault(ctx, userId);
  },
});

/**
 * Aggregate the resources consumed by the current user: encrypted storage
 * bytes used, attached file count and active vault item count. Used by the
 * "Usage" settings page. Category and file-kind breakdowns are computed on
 * the client from the decrypted metadata (F4).
 *
 * Storage sums the files' size buckets (the quota's unit) and counts only
 * files attached to non-archived items so archived data does not inflate the
 * displayed total.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const user = await ctx.db.get(userId);
    const plan = getUserPlan(user ?? { plan: undefined });

    const items = await getActiveItems(ctx, userId);
    const files = await getActiveVaultFiles(ctx, userId);

    const bytesByKind = { document: 0, image: 0, audio: 0, video: 0 };
    for (const file of files) {
      bytesByKind[file.kind ?? "document"] += storedFileBytes(file);
    }

    const { activeBytes, archiveBytes } = await getStorageUsage(ctx, userId);

    return {
      storageBytes: activeBytes + archiveBytes,
      archiveBytes,
      bytesByKind,
      fileCount: files.length,
      activeItemsCount: items.length,
      plan,
      quotaBytes: PLAN_QUOTA_BYTES[plan],
    };
  },
});

export const canStore = query({
  args: { bytes: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const user = await ctx.db.get(userId);
    const quotaBytes =
      PLAN_QUOTA_BYTES[getUserPlan(user ?? { plan: undefined })];
    const { activeBytes, archiveBytes } = await getStorageUsage(ctx, userId);
    const usedBytes = activeBytes + archiveBytes;
    return {
      fits: usedBytes + sizeBucket(args.bytes) <= quotaBytes,
      usedBytes,
      quotaBytes,
    };
  },
});
