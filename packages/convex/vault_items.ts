import {
  internalMutation,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { categoryValidator, accessLevelValidator } from "./validators";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  getActiveStorageBytes,
  requireItemOwnership,
  resolveItemRecipients,
} from "./helpers";
import { auditedMutation } from "./audit";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./lib/plans";
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
          encryptedTitle: item.encryptedTitle,
          ownerWrappedDek: item.ownerWrappedDek,
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
 * Reject an upload that would push the user past their plan's storage ceiling
 * (Free 100 MB / Lifetime 10 GB — see lib/plans.ts). Throws
 * `"STORAGE_QUOTA_EXCEEDED"`, which the client maps to an upgrade prompt.
 * Sizes are the encrypted blob byte lengths the client just uploaded.
 */
async function assertWithinStorageQuota(
  ctx: MutationCtx,
  userId: Id<"users">,
  files: { size: number }[],
): Promise<void> {
  if (files.length === 0) return;
  const incoming = files.reduce((sum, f) => sum + f.size, 0);
  const user = await ctx.db.get(userId);
  const plan = getUserPlan(user ?? { plan: undefined });
  const current = await getActiveStorageBytes(ctx, userId);
  if (current + incoming > PLAN_QUOTA_BYTES[plan]) {
    throw new Error("STORAGE_QUOTA_EXCEEDED");
  }
}

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
    // Encrypted under the item's DEK (master key for legacy items), same
    // envelope as encryptedContent. Plaintext titles are no longer written.
    encryptedTitle: v.string(),
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
    // Contacts the owner meant to share with but couldn't wrap yet (their key
    // isn't published). Stored so the owner's client can re-wrap later.
    pendingRecipients: v.optional(v.array(v.id("trusted_contacts"))),
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

    await assertWithinStorageQuota(ctx, userId, args.files ?? []);

    const recipientMode = args.recipientMode ?? "default";
    const sharedWithContacts = args.sharedWithContacts ?? [];
    const sharedWithGroups = args.sharedWithGroups ?? [];
    const pendingRecipients = args.pendingRecipients ?? [];

    // Intros are addressed to trusted contacts by definition — clamp the
    // access level server-side so a malformed client can't smuggle one in
    // as "private" (where the release fan-out would skip it).
    const accessLevel = args.isReleaseIntroduction
      ? "trusted_only"
      : args.accessLevel;

    if (
      sharedWithContacts.length > 0 ||
      sharedWithGroups.length > 0 ||
      pendingRecipients.length > 0
    ) {
      const own = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const ownContactIds = new Set(own.map((c) => c._id));
      for (const cid of [...sharedWithContacts, ...pendingRecipients]) {
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
      encryptedTitle: args.encryptedTitle,
      encryptedContent: args.encryptedContent,
      encryptedLinks: args.encryptedLinks,
      encryptionType: args.encryptionType ?? "aes_256_gcm",
      sharedWithContacts,
      sharedWithGroups,
      pendingRecipients,
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
    encryptedTitle: v.optional(v.string()),
    encryptedContent: v.optional(v.string()),
    encryptedLinks: v.optional(v.string()),
    category: v.optional(categoryValidator),
    accessLevel: v.optional(accessLevelValidator),
    recipientMode: v.optional(recipientModeValidator),
    sharedWithContacts: v.optional(v.array(v.id("trusted_contacts"))),
    sharedWithGroups: v.optional(v.array(v.id("recipient_groups"))),
    recipientKeys: v.optional(v.array(recipientKeyValidator)),
    // Mirror createItem: contacts deferred because their key isn't published.
    pendingRecipients: v.optional(v.array(v.id("trusted_contacts"))),
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
 * Owner items that have at least one deferred (`pendingRecipients`) contact
 * whose encryption key is now published. Drives the client-side re-wrap
 * backfill (useBackfillPendingShares): for each item it returns the
 * `ownerWrappedDek` (so the client can unwrap the DEK) plus the key material of
 * every pending contact ready to receive a wrap. The actual unwrap/verify/wrap
 * happens on the owner's device — the server stays zero-access.
 */
export const getItemsNeedingRewrap = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();

    const result = [];
    for (const item of items) {
      const pending = item.pendingRecipients ?? [];
      // No deferred recipients, or no owner envelope to unwrap the DEK from.
      if (pending.length === 0 || !item.ownerWrappedDek) continue;

      const readyContacts = [];
      for (const contactId of pending) {
        const c = await ctx.db.get(contactId);
        if (!c || c.invitationStatus === "revoked") continue;
        // Only contacts that have fully published their key material can be
        // re-wrapped; the rest stay pending until they do.
        if (
          c.contactPublicKey &&
          c.contactIdentityPublicKey &&
          c.contactPublicKeySignature
        ) {
          readyContacts.push({
            _id: c._id,
            name: c.name,
            contactPublicKey: c.contactPublicKey,
            contactIdentityPublicKey: c.contactIdentityPublicKey,
            contactPublicKeySignature: c.contactPublicKeySignature,
            pinnedIdentityFingerprint: c.pinnedIdentityFingerprint,
          });
        }
      }

      if (readyContacts.length > 0) {
        result.push({
          itemId: item._id,
          ownerWrappedDek: item.ownerWrappedDek,
          encryptionType: item.encryptionType,
          readyContacts,
        });
      }
    }
    return result;
  },
});

/**
 * Add wrapped DEKs for contacts that were deferred at save time (their key
 * wasn't published yet — see `pendingRecipients`). Insert-only and idempotent:
 * unlike `updateItem`, existing recipient-key rows are left untouched, and a
 * contact is only backfilled if it is genuinely pending on this item (so this
 * mutation can't be used to smuggle in an arbitrary recipient). Each contact
 * successfully added is removed from `pendingRecipients`. Owner-only.
 */
export const addRecipientKeys = auditedMutation({
  action: "vault_item.recipients_backfilled",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  getMetadata: (args) => ({ count: args.recipientKeys.length }),
  args: {
    itemId: v.id("vault_items"),
    recipientKeys: v.array(recipientKeyValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    if (args.recipientKeys.length === 0) return;

    const pending = new Set(item.pendingRecipients ?? []);
    const now = Date.now();
    const added = new Set<Id<"trusted_contacts">>();

    for (const rk of args.recipientKeys) {
      // Only backfill a contact that was actually deferred on this item.
      if (!pending.has(rk.contactId)) continue;
      const existing = await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item_contact", (q) =>
          q.eq("itemId", args.itemId).eq("contactId", rk.contactId),
        )
        .first();
      if (existing) {
        // Already wrapped — just clear it from pending below.
        added.add(rk.contactId);
        continue;
      }
      await ctx.db.insert("vault_item_recipient_keys", {
        itemId: args.itemId,
        contactId: rk.contactId,
        wrappedDek: rk.wrappedDek,
        createdAt: now,
      });
      added.add(rk.contactId);
    }

    if (added.size > 0) {
      await ctx.db.patch(args.itemId, {
        pendingRecipients: [...pending].filter((cid) => !added.has(cid)),
        updatedAt: now,
      });
    }
  },
});

/**
 * Client-side title migration: store the encrypted title and drop the legacy
 * plaintext one. The server holds no key, so the owner's client encrypts each
 * legacy title under its DEK (master key for legacy items) and calls this.
 * Idempotent — a row already carrying `encryptedTitle` is just re-patched.
 */
export const backfillItemTitle = auditedMutation({
  action: "vault_item.title_backfilled",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: {
    itemId: v.id("vault_items"),
    encryptedTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);
    await ctx.db.patch(args.itemId, {
      encryptedTitle: args.encryptedTitle,
      title: undefined,
      updatedAt: Date.now(),
    });
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

    await assertWithinStorageQuota(ctx, userId, args.files);

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
