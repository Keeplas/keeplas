import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { accessLevelValidator } from "./validators";
import {
  requireFullAuth,
  getUserVault,
  getActiveItems,
  getStorageUsage,
  requireItemOwnership,
  requireOwnRecipients,
  resolveItemRecipients,
} from "./helpers";
import { auditedMutation } from "./audit";
import { PLAN_QUOTA_BYTES, getUserPlan } from "./lib/plans";
import {
  generateBlobUploadUrl,
  getBlobDownloadUrl,
  getBlobSize,
  sizeBucket,
  storageRefValidator,
  type StorageRef,
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
 * Active vault items projected to what list screens need (sealed title +
 * metadata and the key to open them). `encryptedContent` can be a long note:
 * returning full documents made the list subscription ship every body on
 * every change. Use `getItem` for the detail screen.
 */
async function summarize(
  ctx: QueryCtx,
  userId: Id<"users">,
  items: Doc<"vault_items">[],
) {
  const files = await ctx.db
    .query("vault_item_files")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const filesByItem = new Map<Id<"vault_items">, typeof files>();
  for (const file of files.sort((a, b) => a.order - b.order)) {
    filesByItem.set(file.itemId, [
      ...(filesByItem.get(file.itemId) ?? []),
      file,
    ]);
  }
  return items.map((item) => ({
    _id: item._id,
    folderId: item.folderId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    archivedAt: item.archivedAt,
    title: item.title,
    category: item.category,
    encryptedTitle: item.encryptedTitle,
    encryptedMeta: item.encryptedMeta,
    ownerWrappedDek: item.ownerWrappedDek,
    sharedWithContacts: item.sharedWithContacts ?? [],
    files: (filesByItem.get(item._id) ?? []).map((file) => ({
      encryptedMeta: file.encryptedMeta,
      kind: file.kind,
      durationSec: file.durationSec,
    })),
  }));
}

export const getItemSummaries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    return await summarize(ctx, userId, await getActiveItems(ctx, userId));
  },
});

export const getArchivedItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "archived"),
      )
      .collect();
    const summaries = await summarize(
      ctx,
      userId,
      items.filter((item) => !item.isReleaseIntroduction),
    );
    return summaries.sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  },
});

export const getItemVersions = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return [];
    const versions = await ctx.db
      .query("vault_item_versions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .order("desc")
      .take(200);
    return versions.map((version) => ({
      _id: version._id,
      encryptedTitle: version.encryptedTitle,
      encryptedContent: version.encryptedContent,
      encryptedMeta: version.encryptedMeta,
      encryptedLinks: version.encryptedLinks,
      savedAt: version.savedAt,
      replacedAt: version.replacedAt,
      files: version.files.map((file) => ({
        storageId: file.storageId,
        iv: file.iv,
        encryptedMeta: file.encryptedMeta,
        order: file.order,
      })),
    }));
  },
});

export const getVersionFileUrl = query({
  args: {
    versionId: v.id("vault_item_versions"),
    storageId: storageRefValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.userId !== userId) return null;
    if (!version.files.some((file) => file.storageId === args.storageId)) {
      return null;
    }
    return await getBlobDownloadUrl(ctx, args.storageId);
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

// Name, type and size travel only inside `encryptedMeta` (F4); the server
// measures the stored blob itself for the quota.
const newFileValidator = v.object({
  storageId: storageRefValidator,
  iv: v.string(),
  encryptedMeta: v.string(),
});

type NewFile = { storageId: StorageRef; iv: string; encryptedMeta: string };

/**
 * Size bucket of each uploaded blob, measured from storage (the client
 * cannot under-report). Throws if a blob is missing.
 */
async function measureFiles(ctx: MutationCtx, files: NewFile[]) {
  return await Promise.all(
    files.map(async (file) => {
      const size = await getBlobSize(ctx, file.storageId);
      if (size === null) throw new Error("Uploaded file not found");
      return { ...file, sizeBucket: sizeBucket(size) };
    }),
  );
}

/**
 * Reject an upload that would push the user past their plan's storage ceiling
 * (Free 100 MB / Lifetime 10 GB — see lib/plans.ts). Throws
 * `ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" })` (a ConvexError survives
 * production redaction), which the client maps to an upgrade prompt.
 */
async function assertWithinStorageQuota(
  ctx: MutationCtx,
  userId: Id<"users">,
  files: { sizeBucket: number }[],
): Promise<void> {
  if (files.length === 0) return;
  const incoming = files.reduce((sum, f) => sum + f.sizeBucket, 0);
  const user = await ctx.db.get(userId);
  const plan = getUserPlan(user ?? { plan: undefined });
  const { activeBytes, archiveBytes } = await getStorageUsage(ctx, userId);
  if (activeBytes + archiveBytes + incoming > PLAN_QUOTA_BYTES[plan]) {
    throw new ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" });
  }
}

async function insertFiles(
  ctx: MutationCtx,
  itemId: Id<"vault_items">,
  userId: Id<"users">,
  files: (NewFile & { sizeBucket: number })[],
  firstOrder: number,
  now: number,
) {
  await Promise.all(
    files.map((file, index) =>
      ctx.db.insert("vault_item_files", {
        itemId,
        userId,
        storageId: file.storageId,
        iv: file.iv,
        encryptedMeta: file.encryptedMeta,
        sizeBucket: file.sizeBucket,
        order: firstOrder + index,
        createdAt: now,
      }),
    ),
  );
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
    accessLevel: args.accessLevel,
    recipientMode: args.recipientMode ?? "default",
    fileCount: args.files?.length ?? 0,
    isReleaseIntroduction: args.isReleaseIntroduction ?? false,
  }),
  args: {
    vaultId: v.id("vaults"),
    // JSON {v:1, category} under the item's DEK (F4).
    encryptedMeta: v.string(),
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
    folderId: v.optional(v.id("folders")),
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

    const files = await measureFiles(ctx, args.files ?? []);
    await assertWithinStorageQuota(ctx, userId, files);

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

    await requireOwnRecipients(ctx, userId, {
      contacts: [
        ...sharedWithContacts,
        ...pendingRecipients,
        ...(args.recipientKeys ?? []).map((rk) => rk.contactId),
      ],
      groups: sharedWithGroups,
    });

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== userId) {
        throw new ConvexError("Folder not found");
      }
    }

    const now = Date.now();

    const itemId = await ctx.db.insert("vault_items", {
      vaultId: args.vaultId,
      userId,
      folderId: args.folderId,
      encryptedMeta: args.encryptedMeta,
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

    await insertFiles(ctx, itemId, userId, files, 0, now);

    await ctx.db.patch(args.vaultId, {
      encryptedItemsCount: vault.encryptedItemsCount + 1,
      updatedAt: now,
    });

    return itemId;
  },
});

const CONTENT_FIELDS = [
  "encryptedTitle",
  "encryptedContent",
  "encryptedLinks",
  "encryptedMeta",
] as const;

async function saveVersion(
  ctx: MutationCtx,
  item: Doc<"vault_items">,
  now: number,
) {
  const files = await ctx.db
    .query("vault_item_files")
    .withIndex("by_item", (q) => q.eq("itemId", item._id))
    .collect();
  await ctx.db.insert("vault_item_versions", {
    itemId: item._id,
    userId: item.userId,
    encryptedTitle: item.encryptedTitle,
    encryptedContent: item.encryptedContent,
    encryptedMeta: item.encryptedMeta,
    encryptedLinks: item.encryptedLinks,
    files: files.map((file) => ({
      storageId: file.storageId,
      iv: file.iv,
      encryptedMeta: file.encryptedMeta,
      sizeBucket: file.sizeBucket ?? file.size,
      order: file.order,
    })),
    savedAt: item.updatedAt,
    replacedAt: now,
  });
  return files;
}

function requireNotArchived(item: Doc<"vault_items">) {
  if (item.status === "archived") throw new ConvexError("Item is archived");
}

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
    encryptedMeta: v.optional(v.string()),
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
    removeFileIds: v.optional(v.array(v.id("vault_item_files"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    await requireOwnRecipients(ctx, userId, {
      contacts: [
        ...(args.sharedWithContacts ?? []),
        ...(args.pendingRecipients ?? []),
        ...(args.recipientKeys ?? []).map((rk) => rk.contactId),
      ],
      groups: args.sharedWithGroups ?? [],
    });

    const { itemId, recipientKeys, removeFileIds = [], ...updates } = args;
    const now = Date.now();
    const editsContent =
      removeFileIds.length > 0 ||
      CONTENT_FIELDS.some((field) => args[field] !== undefined);
    if (editsContent) {
      requireNotArchived(item);
      const files = await saveVersion(ctx, item, now);
      for (const fileId of removeFileIds) {
        if (!files.some((file) => file._id === fileId)) {
          throw new Error("File not found");
        }
        await ctx.db.delete(fileId);
      }
    }
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
 * Owner items still carrying plaintext metadata (F4), with what the client
 * needs to seal it: the legacy values and the DEK envelope.
 */
export const getItemsNeedingMetaBackfill = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const item of items) {
      const files = await ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      const legacyFiles = files.filter((f) => f.encryptedMeta === undefined);
      if (item.encryptedMeta !== undefined && legacyFiles.length === 0) {
        continue;
      }
      out.push({
        itemId: item._id,
        encryptionType: item.encryptionType,
        ownerWrappedDek: item.ownerWrappedDek,
        category: item.encryptedMeta === undefined ? item.category : undefined,
        files: legacyFiles.map((f) => ({
          fileId: f._id,
          name: f.name ?? "",
          mimeType: f.mimeType ?? "application/octet-stream",
          size: f.size ?? 0,
          kind: f.kind ?? "document",
          durationSec: f.durationSec,
        })),
      });
    }
    return out;
  },
});

/**
 * Client-side metadata migration (F4): store the sealed metadata and drop the
 * plaintext columns. The file's size becomes a bucket measured from storage.
 */
export const backfillItemMeta = auditedMutation({
  action: "vault_item.meta_backfilled",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: {
    itemId: v.id("vault_items"),
    encryptedMeta: v.optional(v.string()),
    files: v.array(
      v.object({
        fileId: v.id("vault_item_files"),
        encryptedMeta: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireItemOwnership(ctx, args.itemId, userId);
    if (args.encryptedMeta !== undefined) {
      await ctx.db.patch(args.itemId, {
        encryptedMeta: args.encryptedMeta,
        category: undefined,
      });
    }
    for (const update of args.files) {
      const file = await ctx.db.get(update.fileId);
      if (!file || file.itemId !== args.itemId) {
        throw new Error("File not found");
      }
      const size = await getBlobSize(ctx, file.storageId);
      await ctx.db.patch(file._id, {
        encryptedMeta: update.encryptedMeta,
        sizeBucket: sizeBucket(size ?? file.size ?? 0),
        name: undefined,
        mimeType: undefined,
        size: undefined,
        kind: undefined,
        durationSec: undefined,
      });
    }
  },
});

/**
 * Rows still holding plaintext metadata. The plaintext columns are dropped
 * from the schema once both counts reach zero (F4 narrow step).
 */
export const countPlaintextMetadata = internalQuery({
  args: {},
  handler: async (ctx) => {
    let items = 0;
    for await (const item of ctx.db.query("vault_items")) {
      if (item.category !== undefined) items++;
    }
    let files = 0;
    for await (const file of ctx.db.query("vault_item_files")) {
      if (
        file.name !== undefined ||
        file.mimeType !== undefined ||
        file.size !== undefined ||
        file.kind !== undefined
      ) {
        files++;
      }
    }
    return { items, files };
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

    const files = await measureFiles(ctx, args.files);
    await assertWithinStorageQuota(ctx, userId, files);

    const existing = await ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    const nextOrder =
      existing.reduce((max, f) => Math.max(max, f.order), -1) + 1;

    const now = Date.now();
    await insertFiles(ctx, args.itemId, userId, files, nextOrder, now);

    await ctx.db.patch(args.itemId, { updatedAt: now });
  },
});

/**
 * Detach a single attachment from a vault item. The item's previous state,
 * this file included, is kept as a version, so the blob stays in storage.
 * Ownership is verified on both the item and the file.
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
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    requireNotArchived(item);

    const file = await ctx.db.get(args.fileId);
    if (!file || file.itemId !== args.itemId || file.userId !== userId) {
      throw new Error("File not found");
    }

    const now = Date.now();
    await saveVersion(ctx, item, now);
    await ctx.db.delete(args.fileId);
    await ctx.db.patch(args.itemId, { updatedAt: now });
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

export const archiveItem = auditedMutation({
  action: "vault_item.archived",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    if (item.status === "archived") return;
    const now = Date.now();
    await ctx.db.patch(args.itemId, {
      status: "archived",
      archivedFromStatus: item.status,
      archivedAt: now,
    });
    const vault = await ctx.db.get(item.vaultId);
    if (vault) {
      await ctx.db.patch(item.vaultId, {
        encryptedItemsCount: Math.max(0, vault.encryptedItemsCount - 1),
        updatedAt: now,
      });
    }
  },
});

export const unarchiveItem = auditedMutation({
  action: "vault_item.unarchived",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    if (item.status !== "archived") return;
    const now = Date.now();
    await ctx.db.patch(args.itemId, {
      status: item.archivedFromStatus ?? "active",
      archivedFromStatus: undefined,
      archivedAt: undefined,
    });
    const vault = await ctx.db.get(item.vaultId);
    if (vault) {
      await ctx.db.patch(item.vaultId, {
        encryptedItemsCount: vault.encryptedItemsCount + 1,
        updatedAt: now,
      });
    }
  },
});

export const restoreItemVersion = auditedMutation({
  action: "vault_item.version_restored",
  resourceType: "vault_item",
  getResourceId: (args) => args.itemId,
  getMetadata: (args) => ({ versionId: args.versionId }),
  args: {
    itemId: v.id("vault_items"),
    versionId: v.id("vault_item_versions"),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    requireNotArchived(item);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.itemId !== args.itemId) {
      throw new Error("Version not found");
    }

    const now = Date.now();
    const current = await saveVersion(ctx, item, now);
    const kept = new Set(version.files.map((file) => file.storageId));
    for (const file of current) {
      if (!kept.has(file.storageId)) await ctx.db.delete(file._id);
    }
    const present = new Set(current.map((file) => file.storageId));
    for (const file of version.files) {
      if (present.has(file.storageId)) continue;
      await ctx.db.insert("vault_item_files", {
        itemId: args.itemId,
        userId,
        storageId: file.storageId,
        iv: file.iv,
        encryptedMeta: file.encryptedMeta,
        sizeBucket: file.sizeBucket,
        order: file.order,
        createdAt: now,
      });
    }
    await ctx.db.patch(args.itemId, {
      encryptedTitle: version.encryptedTitle,
      encryptedContent: version.encryptedContent,
      encryptedMeta: version.encryptedMeta,
      encryptedLinks: version.encryptedLinks,
      updatedAt: now,
    });
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
