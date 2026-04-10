import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./audit";

const categoryValidator = v.union(
  v.literal("personal_document"),
  v.literal("financial_asset"),
  v.literal("digital_asset"),
  v.literal("health_directive"),
  v.literal("legal_document"),
  v.literal("business_continuity"),
  v.literal("conditional_message"),
  v.literal("personal_message"),
  v.literal("credential")
);

const accessLevelValidator = v.union(
  v.literal("private"),
  v.literal("trusted_only"),
  v.literal("emergency_only"),
  v.literal("public")
);

// ─── Queries ────────────────────────────────────────────

/**
 * Get all active vault items for the current user.
 */
export const getItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();
  },
});

/**
 * Get vault items filtered by category.
 */
export const getItemsByCategory = query({
  args: { category: categoryValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const vault = await ctx.db
      .query("vaults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) return {};

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

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

    // Audit log
    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "vault_item_created",
      resourceType: "vault_item",
      resourceId: itemId,
    });

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    const { itemId, ...updates } = args;
    // Remove undefined values
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(itemId, patch);

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "vault_item_updated",
      resourceType: "vault_item",
      resourceId: itemId,
    });
  },
});

/**
 * Soft-delete a vault item (archive it).
 */
export const deleteItem = mutation({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.itemId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    // Update vault counts
    const vault = await ctx.db.get(item.vaultId);
    if (vault) {
      await ctx.db.patch(item.vaultId, {
        encryptedItemsCount: Math.max(0, vault.encryptedItemsCount - 1),
        updatedAt: Date.now(),
      });
    }

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "vault_item_archived",
      resourceType: "vault_item",
      resourceId: args.itemId,
    });
  },
});
