import { v, ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { auditedMutation } from "./audit";
import { optionalAuth, requireFullAuth } from "./helpers";

/**
 * Categories the owner adds next to the built-in ones. Names are sealed
 * client-side under the master key; the server only stores ciphertext.
 */

/** Owner's categories, oldest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("vault_categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = auditedMutation({
  action: "vault_category.created",
  resourceType: "vault_category",
  args: { encryptedName: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    return await ctx.db.insert("vault_categories", {
      userId,
      encryptedName: args.encryptedName,
      createdAt: Date.now(),
    });
  },
  getResourceId: (_args, categoryId) => categoryId,
});

/**
 * Delete a category. Its items keep their sealed metadata; the apps show an
 * item whose category no longer exists in the Inbox.
 */
export const remove = auditedMutation({
  action: "vault_category.deleted",
  resourceType: "vault_category",
  args: { categoryId: v.id("vault_categories") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new ConvexError("Category not found");
    }
    await ctx.db.delete(args.categoryId);
  },
  getResourceId: (args) => args.categoryId,
});
