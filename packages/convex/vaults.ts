import { mutation, query } from "./_generated/server";
import { requireAuth, optionalAuth, getUserVault } from "./helpers";

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
