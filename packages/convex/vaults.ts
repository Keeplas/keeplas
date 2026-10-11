import { mutation, query } from "./_generated/server";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  getActiveVaultFiles,
} from "./helpers";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./lib/plans";
import { storedFileBytes } from "./lib/storage";

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

    return {
      storageBytes: files.reduce((sum, f) => sum + storedFileBytes(f), 0),
      fileCount: files.length,
      activeItemsCount: items.length,
      plan,
      quotaBytes: PLAN_QUOTA_BYTES[plan],
    };
  },
});
