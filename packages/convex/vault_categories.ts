import { v, ConvexError } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { optionalAuth, requireFullAuth } from "./helpers";

/**
 * Categories the owner adds next to the built-in ones. Names are sealed
 * client-side under the master key; the server only stores ciphertext.
 */

async function requireOwnCategory(
  ctx: QueryCtx,
  categoryId: Id<"vault_categories">,
  userId: Id<"users">,
) {
  const category = await ctx.db.get(categoryId);
  if (!category || category.userId !== userId) {
    throw new ConvexError("Category not found");
  }
}

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

export const rename = auditedMutation({
  action: "vault_category.renamed",
  resourceType: "vault_category",
  args: {
    categoryId: v.id("vault_categories"),
    encryptedName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnCategory(ctx, args.categoryId, userId);
    await ctx.db.patch(args.categoryId, { encryptedName: args.encryptedName });
  },
  getResourceId: (args) => args.categoryId,
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
    await requireOwnCategory(ctx, args.categoryId, userId);
    await ctx.db.delete(args.categoryId);
  },
  getResourceId: (args) => args.categoryId,
});
