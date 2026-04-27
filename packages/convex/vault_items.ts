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
  resolveItemRecipients,
} from "./helpers";

const triggerTypeValidator = v.union(
  v.literal("life_check_failure"),
  v.literal("time_based"),
  v.literal("manual")
);

const triggerConfigValidator = v.object({
  releaseDate: v.optional(v.number()),
});

const recipientModeValidator = v.union(
  v.literal("default"),
  v.literal("groups"),
  v.literal("explicit")
);

const recipientKeyValidator = v.object({
  contactId: v.id("trusted_contacts"),
  wrappedDek: v.string(),
  // Deprecated — kept optional for backward-compat with legacy clients.
  // ML-KEM envelope carries the IV inside the wrappedDek JSON.
  wrappedDekIv: v.optional(v.string()),
});

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
 *
 * Per-recipient release: pass recipientMode + sharedWithGroups OR
 * sharedWithContacts, plus recipientKeys (DEK pre-wrapped to each
 * recipient's contactPublicKey). When mode is "default", the client
 * still wraps DEKs to all current trust contacts so the trigger doesn't
 * need user keys.
 */
export const createItem = mutation({
  args: {
    vaultId: v.id("vaults"),
    category: categoryValidator,
    title: v.string(),
    description: v.optional(v.string()),
    encryptedContent: v.string(),
    encryptedLinks: v.optional(v.string()),
    contentHash: v.string(),
    accessLevel: accessLevelValidator,
    encryptionType: v.optional(
      v.union(v.literal("aes_256_gcm"), v.literal("zero_knowledge"))
    ),
    ownerWrappedDek: v.optional(v.string()),
    ownerWrappedDekIv: v.optional(v.string()),
    recipientMode: v.optional(recipientModeValidator),
    sharedWithContacts: v.optional(v.array(v.id("trusted_contacts"))),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientKeys: v.optional(v.array(recipientKeyValidator)),
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
    triggerType: v.optional(triggerTypeValidator),
    triggerConfig: v.optional(triggerConfigValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }

    const recipientMode = args.recipientMode ?? "default";
    const sharedWithContacts = args.sharedWithContacts ?? [];
    const sharedWithGroups = args.sharedWithGroups ?? [];

    if (sharedWithContacts.length > 0 || sharedWithGroups.length > 0) {
      const own = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const ownContactIds = new Set(own.map((c) => c._id));
      for (const cid of sharedWithContacts) {
        if (!ownContactIds.has(cid)) {
          throw new Error("One or more contacts are not yours");
        }
      }
      for (const gid of sharedWithGroups) {
        const g = await ctx.db.get(gid);
        if (!g || g.userId !== userId) {
          throw new Error("One or more groups are not yours");
        }
      }
    }

    const now = Date.now();

    const itemId = await ctx.db.insert("vault_items", {
      vaultId: args.vaultId,
      userId,
      category: args.category,
      title: args.title,
      description: args.description,
      encryptedContent: args.encryptedContent,
      encryptedLinks: args.encryptedLinks,
      encryptionType: args.encryptionType ?? "aes_256_gcm",
      contentHash: args.contentHash,
      sharedWithContacts,
      sharedWithGroups,
      recipientMode,
      ownerWrappedDek: args.ownerWrappedDek,
      ownerWrappedDekIv: args.ownerWrappedDekIv,
      accessLevel: args.accessLevel,
      status: "active",
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      createdAt: now,
      updatedAt: now,
    });

    if (args.recipientKeys && args.recipientKeys.length > 0) {
      await Promise.all(
        args.recipientKeys.map((rk) =>
          ctx.db.insert("vault_item_recipient_keys", {
            itemId,
            contactId: rk.contactId,
            wrappedDek: rk.wrappedDek,
            wrappedDekIv: rk.wrappedDekIv,
            createdAt: now,
          })
        )
      );
    }

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

    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: now,
    });

    await logVaultAction(ctx, userId, "vault_item_created", itemId);

    return itemId;
  },
});

/**
 * Update an existing vault item (re-encrypted content). When recipient
 * configuration changes, pass recipientKeys to re-wrap the DEK for the
 * new recipient set; existing wrapped-DEK rows are replaced.
 */
export const updateItem = mutation({
  args: {
    itemId: v.id("vault_items"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    encryptedContent: v.optional(v.string()),
    encryptedLinks: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    category: v.optional(categoryValidator),
    accessLevel: v.optional(accessLevelValidator),
    recipientMode: v.optional(recipientModeValidator),
    sharedWithContacts: v.optional(v.array(v.id("trusted_contacts"))),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientKeys: v.optional(v.array(recipientKeyValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);

    const { itemId, recipientKeys, ...updates } = args;
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(itemId, patch);

    if (recipientKeys !== undefined) {
      const existing = await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect();
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
      await Promise.all(
        recipientKeys.map((rk) =>
          ctx.db.insert("vault_item_recipient_keys", {
            itemId,
            contactId: rk.contactId,
            wrappedDek: rk.wrappedDek,
            wrappedDekIv: rk.wrappedDekIv,
            createdAt: now,
          })
        )
      );
    }

    await logVaultAction(ctx, userId, "vault_item_updated", itemId);
  },
});

/**
 * Resolve the effective recipient list for a vault item (preview before
 * trigger). Useful for the UI to display "Will reach: A, B, C".
 */
export const resolveRecipientsForItem = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return [];

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return [];

    return await resolveItemRecipients(ctx, item, userId);
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

/**
 * Heartbeat / Dead-Man-Switch overall status derived from the user's life
 * check config plus any vault items configured with a trigger.
 */
export const getDeadManStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("triggerType"), undefined))
      .collect();

    return {
      isActive: !!config?.isActive && !config.travelModeEnabled,
      lastHeartbeatAt: config?.lastCheckAt ?? null,
      nextHeartbeatAt: config?.nextCheckAt ?? null,
      activeMessages: items.filter((m) => m.status === "active").length,
      draftMessages: items.filter((m) => m.status === "draft").length,
      curatorsRequired: 3,
    };
  },
});
