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

/**
 * List the encrypted files attached to a vault item, sorted by their stored order.
 */
export const getItemFiles = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return [];

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return [];

    const files = await ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    return files.sort((a, b) => a.order - b.order);
  },
});

/**
 * Return a short-lived signed URL that lets the client fetch a stored
 * ciphertext blob for in-browser decryption.
 */
export const getItemFileUrl = query({
  args: { fileId: v.id("vault_item_files") },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== userId) return null;

    return await ctx.storage.getUrl(file.storageId);
  },
});

// ─── Mutations ──────────────────────────────────────────

/**
 * Issue a short-lived signed URL so the client can POST an
 * encrypted blob directly to Convex storage.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

const fileKindValidator = v.union(
  v.literal("document"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("image")
);

/**
 * Create a new encrypted vault item, optionally attaching pre-uploaded
 * encrypted blobs stored in Convex storage.
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
    files: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          mimeType: v.string(),
          size: v.number(),
          iv: v.string(),
          kind: fileKindValidator,
          durationSec: v.optional(v.number()),
        })
      )
    ),
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

    if (args.files && args.files.length > 0) {
      await Promise.all(
        args.files.map((file, index) =>
          ctx.db.insert("vault_item_files", {
            itemId,
            userId,
            storageId: file.storageId,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            iv: file.iv,
            kind: file.kind,
            durationSec: file.durationSec,
            order: index,
            createdAt: now,
          })
        )
      );
    }

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
 * Soft-delete a vault item (archive it). Attached encrypted files are
 * kept in storage — restoration can undo the archive.
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
