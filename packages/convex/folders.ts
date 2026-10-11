import { v, ConvexError } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import {
  approvedReleaseRequest,
  optionalAuth,
  requireFullAuth,
  requireItemOwnership,
  resolveItemRecipients,
} from "./helpers";
import { getBlobDownloadUrl } from "./lib/storage";

/**
 * Sharing per folder (v2, M06-4 / M06-6 / M03-1 / M03-2 / W04-4). A grant
 * gives one contact "this folder only", now or after verification. The owner's
 * client wraps each item DEK in the folder to the grantee
 * (vault_item_recipient_keys) and seals the folder name to them; the server
 * only authorizes and relays ciphertext.
 */

const timingValidator = v.union(
  v.literal("now"),
  v.literal("after_verification"),
);

const itemKeyValidator = v.object({
  itemId: v.id("vault_items"),
  wrappedDek: v.string(),
});

async function requireOwnFolder(
  ctx: QueryCtx,
  folderId: Id<"folders">,
  userId: Id<"users">,
) {
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== userId) {
    throw new ConvexError("Folder not found");
  }
  return folder;
}

async function folderItems(ctx: QueryCtx, folderId: Id<"folders">) {
  const items = await ctx.db
    .query("vault_items")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();
  return items.filter((i) => i.status !== "archived");
}

async function grantsOf(ctx: QueryCtx, folderId: Id<"folders">) {
  return await ctx.db
    .query("folder_grants")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();
}

/**
 * Store DEK wraps for a contact, only for items of `folderId` (so this cannot
 * smuggle access to anything else). Idempotent per (item, contact).
 */
async function storeItemKeys(
  ctx: MutationCtx,
  folderId: Id<"folders">,
  contactId: Id<"trusted_contacts">,
  keys: { itemId: Id<"vault_items">; wrappedDek: string }[],
) {
  const now = Date.now();
  for (const key of keys) {
    const item = await ctx.db.get(key.itemId);
    if (item?.folderId !== folderId) continue;
    const existing = await ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_item_contact", (q) =>
        q.eq("itemId", key.itemId).eq("contactId", contactId),
      )
      .first();
    if (existing) continue;
    await ctx.db.insert("vault_item_recipient_keys", {
      itemId: key.itemId,
      contactId,
      wrappedDek: key.wrappedDek,
      createdAt: now,
    });
  }
}

/**
 * Remove a contact's DEK wraps on `items` unless the contact still receives
 * the item another way (item-level sharing).
 */
async function dropItemKeys(
  ctx: MutationCtx,
  items: Doc<"vault_items">[],
  contactId: Id<"trusted_contacts">,
) {
  for (const item of items) {
    const recipients = await resolveItemRecipients(ctx, item, item.userId);
    if (item.accessLevel !== "private" && recipients.includes(contactId)) {
      continue;
    }
    const row = await ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_item_contact", (q) =>
        q.eq("itemId", item._id).eq("contactId", contactId),
      )
      .first();
    if (row) await ctx.db.delete(row._id);
  }
}

// ─── Owner ───────────────────────────────────────────────────────────────

/** Owner's folders with item counts and who has access (M06-6). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return await Promise.all(
      folders.map(async (folder) => ({
        ...folder,
        itemCount: (await folderItems(ctx, folder._id)).length,
        grants: await Promise.all(
          (await grantsOf(ctx, folder._id)).map(async (g) => ({
            grantId: g._id,
            contactId: g.contactId,
            contactName: (await ctx.db.get(g.contactId))?.name ?? "",
            timing: g.timing,
            createdAt: g.createdAt,
          })),
        ),
      })),
    );
  },
});

export const create = auditedMutation({
  action: "folder.created",
  resourceType: "folder",
  args: { encryptedName: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const now = Date.now();
    return await ctx.db.insert("folders", {
      userId,
      encryptedName: args.encryptedName,
      createdAt: now,
      updatedAt: now,
    });
  },
  getResourceId: (_args, folderId) => folderId,
});

/** Rename: new owner ciphertext and the name re-sealed to every grantee. */
export const rename = auditedMutation({
  action: "folder.renamed",
  resourceType: "folder",
  args: {
    folderId: v.id("folders"),
    encryptedName: v.string(),
    sealedNames: v.array(
      v.object({ grantId: v.id("folder_grants"), sealedName: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnFolder(ctx, args.folderId, userId);
    await ctx.db.patch(args.folderId, {
      encryptedName: args.encryptedName,
      updatedAt: Date.now(),
    });
    for (const { grantId, sealedName } of args.sealedNames) {
      const grant = await ctx.db.get(grantId);
      if (grant?.folderId === args.folderId) {
        await ctx.db.patch(grantId, { sealedName });
      }
    }
  },
  getResourceId: (args) => args.folderId,
});

/** Delete a folder: its items stay in the vault, its grants end. */
export const remove = auditedMutation({
  action: "folder.deleted",
  resourceType: "folder",
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnFolder(ctx, args.folderId, userId);
    const items = await folderItems(ctx, args.folderId);
    for (const grant of await grantsOf(ctx, args.folderId)) {
      await dropItemKeys(ctx, items, grant.contactId);
      await ctx.db.delete(grant._id);
    }
    for (const item of items) {
      await ctx.db.patch(item._id, { folderId: undefined });
    }
    await ctx.db.delete(args.folderId);
  },
  getResourceId: (args) => args.folderId,
});

/**
 * Move an item into a folder (or out with `folderId` null). The client wraps
 * the item DEK to every grantee of the target folder (`recipientKeys`);
 * grantees of the previous folder lose their wrap.
 */
export const moveItem = auditedMutation({
  action: "folder.item_moved",
  resourceType: "vault_item",
  args: {
    itemId: v.id("vault_items"),
    folderId: v.union(v.id("folders"), v.null()),
    recipientKeys: v.array(
      v.object({
        contactId: v.id("trusted_contacts"),
        wrappedDek: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    if (args.folderId) await requireOwnFolder(ctx, args.folderId, userId);

    if (item.folderId && item.folderId !== args.folderId) {
      for (const grant of await grantsOf(ctx, item.folderId)) {
        await dropItemKeys(ctx, [item], grant.contactId);
      }
    }
    await ctx.db.patch(args.itemId, {
      folderId: args.folderId ?? undefined,
      updatedAt: Date.now(),
    });
    if (args.folderId) {
      const granted = new Set(
        (await grantsOf(ctx, args.folderId)).map((g) => g.contactId),
      );
      for (const key of args.recipientKeys) {
        if (!granted.has(key.contactId)) continue;
        await storeItemKeys(ctx, args.folderId, key.contactId, [
          { itemId: args.itemId, wrappedDek: key.wrappedDek },
        ]);
      }
    }
  },
  getResourceId: (args) => args.itemId,
});

/** M06-4: give a contact access to this folder only, now or later. */
export const grant = auditedMutation({
  action: "folder.access_granted",
  resourceType: "folder",
  args: {
    folderId: v.id("folders"),
    contactId: v.id("trusted_contacts"),
    timing: timingValidator,
    sealedName: v.string(),
    itemKeys: v.array(itemKeyValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnFolder(ctx, args.folderId, userId);
    const contact = await ctx.db.get(args.contactId);
    if (
      !contact ||
      contact.userId !== userId ||
      contact.invitationStatus === "revoked"
    ) {
      throw new ConvexError("Contact not found");
    }
    const existing = (await grantsOf(ctx, args.folderId)).find(
      (g) => g.contactId === args.contactId,
    );
    if (existing) throw new ConvexError("This person already has access");
    const grantId = await ctx.db.insert("folder_grants", {
      folderId: args.folderId,
      ownerId: userId,
      contactId: args.contactId,
      timing: args.timing,
      sealedName: args.sealedName,
      createdAt: Date.now(),
    });
    await storeItemKeys(ctx, args.folderId, args.contactId, args.itemKeys);
    return grantId;
  },
  getResourceId: (args) => args.folderId,
  getMetadata: (args) => ({ contactId: args.contactId, timing: args.timing }),
});

/** Change when a grantee gets access (M06-6 Edit). */
export const updateGrant = auditedMutation({
  action: "folder.access_updated",
  resourceType: "folder_grant",
  args: { grantId: v.id("folder_grants"), timing: timingValidator },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const grant = await ctx.db.get(args.grantId);
    if (grant?.ownerId !== userId) throw new ConvexError("Access not found");
    await ctx.db.patch(args.grantId, { timing: args.timing });
  },
  getResourceId: (args) => args.grantId,
  getMetadata: (args) => ({ timing: args.timing }),
});

/**
 * M06-6 Revoke: no future access. Copies the person already saved cannot be
 * removed (said in the UI).
 */
export const revokeGrant = auditedMutation({
  action: "folder.access_revoked",
  resourceType: "folder_grant",
  args: { grantId: v.id("folder_grants") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const grant = await ctx.db.get(args.grantId);
    if (grant?.ownerId !== userId) throw new ConvexError("Access not found");
    await dropItemKeys(
      ctx,
      await folderItems(ctx, grant.folderId),
      grant.contactId,
    );
    await ctx.db.delete(args.grantId);
  },
  getResourceId: (args) => args.grantId,
});

/**
 * Folder grantees with "after verification" timing receive the folder's
 * items at release (called by release.fanOutRelease).
 */
export async function releasedFolderItems(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<Map<Id<"trusted_contacts">, Id<"vault_items">[]>> {
  const out = new Map<Id<"trusted_contacts">, Id<"vault_items">[]>();
  const folders = await ctx.db
    .query("folders")
    .withIndex("by_user", (q) => q.eq("userId", ownerId))
    .collect();
  for (const folder of folders) {
    const grants = (await grantsOf(ctx, folder._id)).filter(
      (g) => g.timing === "after_verification",
    );
    if (grants.length === 0) continue;
    const itemIds = (await folderItems(ctx, folder._id)).map((i) => i._id);
    for (const g of grants) {
      out.set(g.contactId, [...(out.get(g.contactId) ?? []), ...itemIds]);
    }
  }
  return out;
}

// ─── Recipient ───────────────────────────────────────────────────────────

/**
 * The caller's grant if they are its contact's user, with whether the folder
 * is open to them now.
 */
async function resolveGrant(ctx: QueryCtx, grantId: Id<"folder_grants">) {
  const me = await requireFullAuth(ctx);
  const grant = await ctx.db.get(grantId);
  if (!grant) return null;
  const contact = await ctx.db.get(grant.contactId);
  if (
    !contact ||
    contact.contactUserId !== me ||
    contact.invitationStatus !== "accepted"
  ) {
    return null;
  }
  const available =
    grant.timing === "now" ||
    (await approvedReleaseRequest(ctx, contact._id)) !== null;
  return { grant, contact, available };
}

/** M03-1 / W04-4: folders other people shared with me. */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const me = await optionalAuth(ctx);
    if (!me) return [];
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", me))
      .collect();
    const out = [];
    for (const contact of contacts) {
      if (contact.invitationStatus !== "accepted") continue;
      const grants = await ctx.db
        .query("folder_grants")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
        .collect();
      if (grants.length === 0) continue;
      const released =
        (await approvedReleaseRequest(ctx, contact._id)) !== null;
      const owner = await ctx.db.get(contact.userId);
      for (const grant of grants) {
        out.push({
          grantId: grant._id,
          ownerName: owner?.name ?? "",
          sealedName: grant.sealedName,
          timing: grant.timing,
          available: grant.timing === "now" || released,
          itemCount: (await folderItems(ctx, grant.folderId)).length,
          sharedAt: grant.createdAt,
        });
      }
    }
    return out;
  },
});

/** M03-2: the items of a shared folder, sealed, with my DEK wraps. */
export const getSharedFolder = query({
  args: { grantId: v.id("folder_grants") },
  handler: async (ctx, args) => {
    const resolved = await resolveGrant(ctx, args.grantId);
    if (!resolved?.available) return null;
    const { grant, contact } = resolved;
    const owner = await ctx.db.get(grant.ownerId);
    const items = await folderItems(ctx, grant.folderId);
    return {
      ownerName: owner?.name ?? "",
      sealedName: grant.sealedName,
      items: await Promise.all(
        items.map(async (item) => {
          const key = await ctx.db
            .query("vault_item_recipient_keys")
            .withIndex("by_item_contact", (q) =>
              q.eq("itemId", item._id).eq("contactId", contact._id),
            )
            .first();
          const files = await ctx.db
            .query("vault_item_files")
            .withIndex("by_item", (q) => q.eq("itemId", item._id))
            .collect();
          return {
            _id: item._id,
            encryptedTitle: item.encryptedTitle,
            encryptedMeta: item.encryptedMeta,
            encryptedContent: item.encryptedContent,
            encryptedLinks: item.encryptedLinks,
            wrappedDek: key?.wrappedDek ?? null,
            updatedAt: item.updatedAt,
            files: files
              .sort((a, b) => a.order - b.order)
              .map((f) => ({
                _id: f._id,
                iv: f.iv,
                encryptedMeta: f.encryptedMeta,
                sizeBucket: f.sizeBucket,
              })),
          };
        }),
      ),
    };
  },
});

/** Signed URL of a file in a folder shared with me. */
export const getSharedFileUrl = query({
  args: { grantId: v.id("folder_grants"), fileId: v.id("vault_item_files") },
  handler: async (ctx, args) => {
    const resolved = await resolveGrant(ctx, args.grantId);
    if (!resolved?.available) return null;
    const file = await ctx.db.get(args.fileId);
    if (!file) return null;
    const item = await ctx.db.get(file.itemId);
    if (item?.folderId !== resolved.grant.folderId) return null;
    return await getBlobDownloadUrl(ctx, file.storageId);
  },
});
