import { v, ConvexError } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { optionalAuth, requireFullAuth, requireItemOwnership } from "./helpers";
import { patchCountedItem } from "./lib/storage_usage";

/**
 * Former v2 folders. Folders became categories (who can open an item is set
 * per item): the owner's phone turns each folder into a vault category
 * (`adopt`), moves the category of its items into their sealed metadata
 * (`migrateItem`), then deletes it (`remove`). No new folder is created.
 */

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

export async function folderItems(ctx: QueryCtx, folderId: Id<"folders">) {
  const items = await ctx.db
    .query("vault_items")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();
  return items.filter((i) => i.status !== "archived");
}

/** Owner's folders with their item counts. */
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
      })),
    );
  },
});

/** Delete a folder: its items stay in the vault. */
export const remove = auditedMutation({
  action: "folder.deleted",
  resourceType: "folder",
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnFolder(ctx, args.folderId, userId);
    for (const item of await folderItems(ctx, args.folderId)) {
      await ctx.db.patch(item._id, { folderId: undefined });
    }
    await ctx.db.delete(args.folderId);
  },
  getResourceId: (args) => args.folderId,
});

/**
 * The vault category a folder becomes: same sealed name (both are under the
 * owner's master key). Idempotent, so an interrupted migration resumes.
 */
export const adopt = auditedMutation({
  action: "folder.adopted",
  resourceType: "folder",
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const folder = await requireOwnFolder(ctx, args.folderId, userId);
    if (folder.categoryId && (await ctx.db.get(folder.categoryId))) {
      return folder.categoryId;
    }
    const categoryId = await ctx.db.insert("vault_categories", {
      userId,
      encryptedName: folder.encryptedName,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.folderId, { categoryId, updatedAt: Date.now() });
    return categoryId;
  },
  getResourceId: (args) => args.folderId,
  getMetadata: (_args, categoryId) => ({ categoryId }),
});

/**
 * Take an item out of its folder with its new sealed metadata (which names
 * the folder's category), in one step.
 */
export const migrateItem = auditedMutation({
  action: "folder.item_migrated",
  resourceType: "vault_item",
  args: { itemId: v.id("vault_items"), encryptedMeta: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const item = await requireItemOwnership(ctx, args.itemId, userId);
    if (!item.folderId) throw new ConvexError("Item is not in a folder");
    await patchCountedItem(ctx, item, {
      encryptedMeta: args.encryptedMeta,
      folderId: undefined,
      updatedAt: Date.now(),
    });
  },
  getResourceId: (args) => args.itemId,
});
