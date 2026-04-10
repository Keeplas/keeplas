import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { categoryValidator, accessLevelValidator } from "./validators";
import {
  requireAuth,
  optionalAuth,
  getUserVault,
  getActiveItems,
  requireItemOwnership,
  logVaultAction,
} from "./helpers";

// ─── Queries ────────────────────────────────────────────

/**
 * Get all active vault items for the current user.
 */
export const getItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return [];

    return await getActiveItems(ctx, userId);
  },
});

/**
 * Get vault items filtered by category.
 */
export const getItemsByCategory = query({
  args: { category: categoryValidator },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return [];

    const vault = await getUserVault(ctx, userId);
    if (!vault) return [];

    return await ctx.db
      .query("vault_items")
      .withIndex("by_category", (q) =>
        q.eq("vaultId", vault._id).eq("category", args.category)
      )
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();
  },
});

/**
 * Get a single vault item by ID.
 */
export const getItem = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return null;

    return item;
  },
});

/**
 * Get category counts for the current user's vault.
 */
export const getCategoryCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return {};

    const items = await getActiveItems(ctx, userId);

    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  },
});

// ─── Mutations ──────────────────────────────────────────

/**
 * Create a new encrypted vault item.
 * Content is already encrypted client-side — we store the ciphertext as-is.
 */
export const createItem = mutation({
  args: {
    vaultId: v.id("vaults"),
    category: categoryValidator,
    title: v.string(),
    description: v.optional(v.string()),
    encryptedContent: v.string(),
    contentHash: v.string(),
    accessLevel: accessLevelValidator,
    tags: v.array(v.string()),
    isCritical: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Verify vault ownership
    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }

    const now = Date.now();

    const itemId = await ctx.db.insert("vault_items", {
      vaultId: args.vaultId,
      userId,
      category: args.category,
      title: args.title,
      description: args.description,
      encryptedContent: args.encryptedContent,
      encryptionType: "aes_256_gcm",
      contentHash: args.contentHash,
      sharedWithContacts: [],
      accessLevel: args.accessLevel,
      status: "active",
      tags: args.tags,
      isCritical: args.isCritical,
      createdAt: now,
      updatedAt: now,
    });

    // Update vault counts
    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: now,
    });

    await logVaultAction(ctx, userId, "vault_item_created", itemId);

    return itemId;
  },
});

/**
 * Update an existing vault item (re-encrypted content).
 */
export const updateItem = mutation({
  args: {
    itemId: v.id("vault_items"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    encryptedContent: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    category: v.optional(categoryValidator),
    accessLevel: v.optional(accessLevelValidator),
    tags: v.optional(v.array(v.string())),
    isCritical: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);

    const { itemId, ...updates } = args;
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(itemId, patch);
    await logVaultAction(ctx, userId, "vault_item_updated", itemId);
  },
});

/**
 * Soft-delete a vault item (archive it).
 */
export const deleteItem = mutation({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);

    const now = Date.now();

    await ctx.db.patch(args.itemId, {
      status: "archived",
      updatedAt: now,
    });

    // Update vault counts
    const vault = await ctx.db.get(item.vaultId);
    if (vault) {
      await ctx.db.patch(item.vaultId, {
        encryptedItemsCount: Math.max(0, vault.encryptedItemsCount - 1),
        updatedAt: now,
      });
    }

    await logVaultAction(ctx, userId, "vault_item_archived", args.itemId);
  },
});
