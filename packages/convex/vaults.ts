import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

/**
 * Get or create the user's vault.
 */
export const getOrCreateVault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("vaults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    return await ctx.db
      .query("vaults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});
