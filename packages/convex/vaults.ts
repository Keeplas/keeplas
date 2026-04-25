import { mutation, query } from "./_generated/server";
import { requireAuth, optionalAuth, getUserVault, getActiveItems } from "./helpers";

/**
 * Get or create the user's vault.
 */
export const getOrCreateVault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const existing = await getUserVault(ctx, userId);
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("vaults", {
      userId,
      status: "active",
      securityLevel: "standard",
      integrityScore: 0,
      encryptedItemsCount: 0,
      secureNodesCount: 0,
      lastVerifiedAt: now,
      syncHash: "",
      lastSyncAt: now,
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
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

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
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const items = await getActiveItems(ctx, userId);
    const activeItemIds = new Set(items.map((item) => item._id));

    const allFiles = await ctx.db
      .query("vault_item_files")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const files = allFiles.filter((f) => activeItemIds.has(f.itemId));

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
    };
  },
});
