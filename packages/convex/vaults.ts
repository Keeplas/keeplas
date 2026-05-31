import { mutation, query } from "./_generated/server";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  getActiveVaultFiles,
} from "./helpers";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./lib/plans";

/**
 * Get or create the user's vault.
 */
export const getOrCreateVault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const existing = await getUserVault(ctx, userId);
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
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
 * bytes used, attached file count, active vault item count, and per-category
 * breakdown. Used by the "Usage" settings page so users can monitor their
 * footprint and see when an upgrade would be needed.
 *
 * Storage is computed from `vault_item_files.size` (raw ciphertext byte
 * length, which is what the storage backend actually holds) and counts only
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

    let storageBytes = 0;
    const fileKindCounts: Record<string, number> = {};
    for (const file of files) {
      storageBytes += file.size;
      fileKindCounts[file.kind] = (fileKindCounts[file.kind] ?? 0) + 1;
    }

    const categoryCounts: Record<string, number> = {};
    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
    }

    return {
      storageBytes,
      fileCount: files.length,
      activeItemsCount: items.length,
      categoryCounts,
      fileKindCounts,
      plan,
      quotaBytes: PLAN_QUOTA_BYTES[plan],
    };
  },
});
