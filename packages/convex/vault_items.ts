import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { categoryValidator, accessLevelValidator } from "./validators";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  requireItemOwnership,
  resolveItemRecipients,
} from "./helpers";
import { auditedMutation } from "./audit";
import {
  generateBlobUploadUrl,
  getBlobDownloadUrl,
  deleteBlob,
  storageRefValidator,
} from "./lib/storage";

const triggerTypeValidator = v.union(
  v.literal("life_check_failure"),
  v.literal("time_based"),
  v.literal("manual"),
);

const triggerConfigValidator = v.object({
  releaseDate: v.optional(v.number()),
});

const recipientModeValidator = v.union(
  v.literal("default"),
  v.literal("groups"),
  v.literal("explicit"),
);

const recipientKeyValidator = v.object({
  contactId: v.id("trusted_contacts"),
  // ML-KEM + AES-GCM envelope; the IV lives inside the wrappedDek JSON.
  wrappedDek: v.string(),
});

// ─── Queries ────────────────────────────────────────────

/**
 * Get all active vault items for the current user.
 */
export const getItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    return await getActiveItems(ctx, userId);
  },
});

/**
 * Get vault items filtered by category.
 */
export const getItemsByCategory = query({
  args: { category: categoryValidator },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

    const vault = await getUserVault(ctx, userId);
    if (!vault) return [];

    return await ctx.db
      .query("vault_items")
      .withIndex("by_category", (q) =>
        q.eq("vaultId", vault._id).eq("category", args.category),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "archived"),
          q.neq(q.field("isReleaseIntroduction"), true),
        ),
      )
      .collect();
  },
});

/**
 * List the owner's release-introduction items (welcome messages shown to
 * trusted contacts on the memorial page). Excluded from the regular vault
 * listing — surfaced only through this dedicated query for the /life-check
 * editor.
 *
 * Each row is enriched with a `hasAttachments` flag so the editor can label
 * "Text + recording" without an extra round-trip per item.
 */
export const listReleaseIntroductions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isReleaseIntroduction"), true),
          q.neq(q.field("status"), "archived"),
        ),
      )
      .collect();

    return await Promise.all(
      items.map(async (item) => {
        const firstFile = await ctx.db
          .query("vault_item_files")
          .withIndex("by_item", (q) => q.eq("itemId", item._id))
          .first();
        return {
          _id: item._id,
          title: item.title,
          recipientMode: item.recipientMode ?? "default",
          sharedWithContacts: item.sharedWithContacts,
          sharedWithGroups: item.sharedWithGroups ?? [],
          createdAt: item.createdAt,
          hasAttachments: firstFile !== null,
        };
      }),
    );
  },
});

/**
 * Get a single vault item by ID.
 */
export const getItem = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

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
    const userId = await requireFullAuth(ctx);

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
    const userId = await requireFullAuth(ctx);

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
    const userId = await requireFullAuth(ctx);

    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== userId) return null;

    return await getBlobDownloadUrl(ctx, file.storageId);
  },
});

// ─── Mutations ──────────────────────────────────────────

/**
 * Issue a short-lived signed URL so the client can POST an
 * encrypted blob directly to Convex storage.
 */
export const generateUploadUrl = auditedMutation({
  action: "vault.upload_url.generated",
  resourceType: "vault",
  args: {},
  handler: async (ctx) => {
    await requireFullAuth(ctx);
    return await generateBlobUploadUrl(ctx);
  },
});

const fileKindValidator = v.union(
  v.literal("document"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("image"),
);

const newFileValidator = v.object({
  storageId: storageRefValidator,
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
  iv: v.string(),
  kind: fileKindValidator,
  durationSec: v.optional(v.number()),
});

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
export const createItem = auditedMutation({
  action: "vault_item.created",
  resourceType: "vault_item",
  getResourceId: (_args, result) => result as string,
  getMetadata: (args) => ({
    category: args.category,
    accessLevel: args.accessLevel,
    recipientMode: args.recipientMode ?? "default",
    fileCount: args.files?.length ?? 0,
    isReleaseIntroduction: args.isReleaseIntroduction ?? false,
  }),
  args: {
    vaultId: v.id("vaults"),
    category: categoryValidator,
    title: v.string(),
    encryptedContent: v.string(),
    encryptedLinks: v.optional(v.string()),
    accessLevel: accessLevelValidator,
    encryptionType: v.optional(
      v.union(v.literal("aes_256_gcm"), v.literal("zero_knowledge")),
    ),
    ownerWrappedDek: v.optional(v.string()),
    recipientMode: v.optional(recipientModeValidator),
    sharedWithContacts: v.optional(v.array(v.id("trusted_contacts"))),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientKeys: v.optional(v.array(recipientKeyValidator)),
    files: v.optional(v.array(newFileValidator)),
    triggerType: v.optional(triggerTypeValidator),
    triggerConfig: v.optional(triggerConfigValidator),
    isReleaseIntroduction: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }

    const recipientMode = args.recipientMode ?? "default";
    const sharedWithContacts = args.sharedWithContacts ?? [];
    const sharedWithGroups = args.sharedWithGroups ?? [];

    // Intros are addressed to trusted contacts by definition — clamp the
    // access level server-side so a malformed client can't smuggle one in
    // as "private" (where the release fan-out would skip it).
    const accessLevel = args.isReleaseIntroduction
      ? "trusted_only"
      : args.accessLevel;

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
      encryptedContent: args.encryptedContent,
      encryptedLinks: args.encryptedLinks,
      encryptionType: args.encryptionType ?? "aes_256_gcm",
      sharedWithContacts,
      sharedWithGroups,
      recipientMode,
      ownerWrappedDek: args.ownerWrappedDek,
      accessLevel,
      status: "active",
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      isReleaseIntroduction: args.isReleaseIntroduction,
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
            createdAt: now,
          }),
        ),
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
          }),
        ),
      );
    }

    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: now,
    });

    return itemId;
  },
});

/**
 * Update an existing vault item (re-encrypted content). When recipient
 * configuration changes, pass recipientKeys to re-wrap the DEK for the
 * new recipient set; existing wrapped-DEK rows are replaced.
 */
export const updateItem = auditedMutation({
  action: "vault_item.updated",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  getMetadata: (args) => {
    const fields = Object.entries(args)
      .filter(([k, v]) => k !== "itemId" && v !== undefined)
      .map(([k]) => k);
    return { changedFields: fields };
  },
  args: {
    itemId: v.id("vault_items"),
    title: v.optional(v.string()),
    encryptedContent: v.optional(v.string()),
    encryptedLinks: v.optional(v.string()),
    category: v.optional(categoryValidator),
    accessLevel: v.optional(accessLevelValidator),
    recipientMode: v.optional(recipientModeValidator),
    sharedWithContacts: v.optional(v.array(v.id("trusted_contacts"))),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientKeys: v.optional(v.array(recipientKeyValidator)),
    // Re-keying a ZK item replaces its owner wrap; mirror createItem.
    ownerWrappedDek: v.optional(v.string()),
    isReleaseIntroduction: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);

    const { itemId, recipientKeys, ...updates } = args;
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    // Clamp accessLevel server-side when flipping an item to intro mode
    // (matches createItem's defense-in-depth against malformed clients).
    if (args.isReleaseIntroduction === true) {
      patch.accessLevel = "trusted_only";
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
            createdAt: now,
          }),
        ),
      );
    }
  },
});

/**
 * Attach already-uploaded encrypted blobs to an existing vault item. The
 * client must encrypt each blob under the item's existing DEK (unwrapped
 * via `ownerWrappedDek`) before calling this — the server only links the
 * storage rows.
 */
export const addItemFiles = auditedMutation({
  action: "vault_item.files_added",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  getMetadata: (args) => ({ count: args.files.length }),
  args: {
    itemId: v.id("vault_items"),
    files: v.array(newFileValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);
    if (args.files.length === 0) return;

    const existing = await ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    let nextOrder = existing.reduce((max, f) => Math.max(max, f.order), -1) + 1;

    const now = Date.now();
    await Promise.all(
      args.files.map((file) =>
        ctx.db.insert("vault_item_files", {
          itemId: args.itemId,
          userId,
          storageId: file.storageId,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          iv: file.iv,
          kind: file.kind,
          durationSec: file.durationSec,
          order: nextOrder++,
          createdAt: now,
        }),
      ),
    );

    await ctx.db.patch(args.itemId, { updatedAt: now });
  },
});

/**
 * Detach a single attachment from a vault item: deletes the storage blob
 * and the row. Ownership is verified on both the item and the file.
 */
export const removeItemFile = auditedMutation({
  action: "vault_item.file_removed",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: {
    itemId: v.id("vault_items"),
    fileId: v.id("vault_item_files"),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);

    const file = await ctx.db.get(args.fileId);
    if (!file || file.itemId !== args.itemId || file.userId !== userId) {
      throw new Error("File not found");
    }

    await deleteBlob(ctx, file.storageId);
    await ctx.db.delete(args.fileId);
    await ctx.db.patch(args.itemId, { updatedAt: Date.now() });
  },
});

/**
 * Resolve the effective recipient list for a vault item (preview before
 * trigger). Useful for the UI to display "Will reach: A, B, C".
 */
export const resolveRecipientsForItem = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return [];

    return await resolveItemRecipients(ctx, item, userId);
  },
});

/**
 * Permanently delete a vault item. Removes the document, all per-recipient
 * wrapped DEK rows, every attached file row, and the underlying ciphertext
 * blobs from Convex storage. There is no recovery path — callers must show
 * an explicit confirmation in the UI before invoking this.
 */
export const deleteItem = auditedMutation({
  action: "vault_item.deleted",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);

    const now = Date.now();

    const recipientKeys = await ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    await Promise.all(recipientKeys.map((row) => ctx.db.delete(row._id)));

    const files = await ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    await Promise.all(
      files.map(async (file) => {
        await deleteBlob(ctx, file.storageId);
        await ctx.db.delete(file._id);
      }),
    );

    await ctx.db.delete(args.itemId);

    const vault = await ctx.db.get(item.vaultId);
    if (vault) {
      await ctx.db.patch(item.vaultId, {
        encryptedItemsCount: Math.max(0, vault.encryptedItemsCount - 1),
        updatedAt: now,
      });
    }
  },
});

/**
 * One-shot migration: collapses legacy "public" and "emergency_only" access
 * levels onto "trusted_only". Run once via the Convex dashboard (Functions
 * tab → vault_items:migrateAccessLevels → Run), then this mutation and the
 * matching widening of accessLevelValidator can be deleted together.
 */
export const migrateAccessLevels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("vault_items").collect();
    let migrated = 0;
    for (const item of all) {
      if (
        item.accessLevel === "public" ||
        item.accessLevel === "emergency_only"
      ) {
        await ctx.db.patch(item._id, {
          accessLevel: "trusted_only",
          updatedAt: Date.now(),
        });
        migrated++;
      }
    }
    return { scanned: all.length, migrated };
  },
});

/**
 * Heartbeat / Dead-Man-Switch overall status derived from the user's life
 * check config plus any vault items configured with a trigger.
 */
export const getDeadManStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

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
