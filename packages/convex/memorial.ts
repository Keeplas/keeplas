import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./helpers";
import { getBlobDownloadUrl } from "./lib/storage";

/**
 * Memorial vault — read-only access for a trusted contact to the items a
 * deceased owner RELEASED to THEM (the per-recipient release, "Model A").
 *
 * Authorization is the approved `access_requests` row created by the release
 * fan-out (release.fanOutRelease): one per contact, status "approved", with
 * `sectionsRequested = ["item:<id>", ...]`. Decryption happens entirely on the
 * contact's device using the per-item DEK already wrapped to the contact's own
 * ML-KEM key in `vault_item_recipient_keys` — the server never sees plaintext
 * and the owner's master key is never involved.
 *
 * These queries RETURN null/[] (rather than throw) when the caller is not an
 * authorized recipient, so the reactive contact UI can render a graceful state
 * instead of crashing into an error boundary.
 */

const ITEM_PREFIX = "item:";

type ApprovedRelease = {
  contact: Doc<"trusted_contacts">;
  itemIds: Id<"vault_items">[];
};

/**
 * Resolve the caller's approved release for a contact row, or null when the
 * caller is not that contact's user or no release has been approved.
 */
async function resolveApprovedRelease(
  ctx: QueryCtx,
  contactId: Id<"trusted_contacts">,
): Promise<ApprovedRelease | null> {
  const requesterId = await requireAuth(ctx);

  const contact = await ctx.db.get(contactId);
  if (!contact || contact.contactUserId !== requesterId) return null;

  const request = await ctx.db
    .query("access_requests")
    .withIndex("by_requester", (q) => q.eq("requestedBy", contactId))
    .filter((q) => q.eq(q.field("status"), "approved"))
    .first();
  if (!request) return null;

  const itemIds = request.sectionsRequested
    .filter((s) => s.startsWith(ITEM_PREFIX))
    .map((s) => s.slice(ITEM_PREFIX.length) as Id<"vault_items">);

  return { contact, itemIds };
}

function ownerDisplay(owner: { name?: string; email?: string } | null) {
  const trimmedName = owner?.name?.trim() || "";
  const email = owner?.email ?? "";
  const localPart = email.split("@")[0] ?? "";
  return { name: trimmedName || localPart || "Keeplas user", email };
}

/**
 * Build the encrypted, contact-readable shape of a released item: its
 * ciphertext fields plus the DEK wrapped to THIS contact (joined from
 * vault_item_recipient_keys). `readable` is false for legacy aes_256_gcm items
 * or when no per-recipient wrapped DEK exists (e.g. the contact had no
 * published key when the owner last saved the item).
 */
async function shapeItem(
  ctx: QueryCtx,
  itemId: Id<"vault_items">,
  contactId: Id<"trusted_contacts">,
) {
  const item = await ctx.db.get(itemId);
  if (!item) return null;
  if (item.status === "archived" || item.accessLevel === "private") return null;

  const recRow = await ctx.db
    .query("vault_item_recipient_keys")
    .withIndex("by_item_contact", (q) =>
      q.eq("itemId", itemId).eq("contactId", contactId),
    )
    .first();

  const firstFile = await ctx.db
    .query("vault_item_files")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .first();

  return {
    _id: item._id,
    title: item.title,
    category: item.category,
    encryptionType: item.encryptionType,
    encryptedContent: item.encryptedContent,
    encryptedLinks: item.encryptedLinks ?? null,
    contentHash: item.contentHash,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    wrappedDek: recRow?.wrappedDek ?? null,
    readable: item.encryptionType === "zero_knowledge" && !!recRow?.wrappedDek,
    hasFiles: firstFile !== null,
  };
}

/**
 * The released vault as seen by a contact: owner display info + the list of
 * items released to them (encrypted, with each one's per-recipient wrapped DEK).
 */
export const getReleasedVaultForMe = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const access = await resolveApprovedRelease(ctx, args.contactId);
    if (!access) return null;

    const owner = ownerDisplay(await ctx.db.get(access.contact.userId));

    const items = [];
    for (const itemId of access.itemIds) {
      const shaped = await shapeItem(ctx, itemId, args.contactId);
      if (shaped) items.push(shaped);
    }

    return { owner, items };
  },
});

/**
 * A single released item for the contact detail view. Returns null when the
 * item was not released to this contact (prevents reading a non-bequeathed
 * item by guessing its id).
 */
export const getReleasedItemForMe = query({
  args: {
    contactId: v.id("trusted_contacts"),
    itemId: v.id("vault_items"),
  },
  handler: async (ctx, args) => {
    const access = await resolveApprovedRelease(ctx, args.contactId);
    if (!access || !access.itemIds.includes(args.itemId)) return null;

    const item = await shapeItem(ctx, args.itemId, args.contactId);
    if (!item) return null;

    const owner = ownerDisplay(await ctx.db.get(access.contact.userId));
    return { owner, item };
  },
});

/**
 * Encrypted files attached to a released item, gated on the contact's approved
 * release. Mirrors vault_items.getItemFiles but authorizes via the access
 * request instead of item ownership.
 */
export const getMemorialItemFiles = query({
  args: {
    contactId: v.id("trusted_contacts"),
    itemId: v.id("vault_items"),
  },
  handler: async (ctx, args) => {
    const access = await resolveApprovedRelease(ctx, args.contactId);
    if (!access || !access.itemIds.includes(args.itemId)) return [];

    const files = await ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    return files.sort((a, b) => a.order - b.order);
  },
});

/**
 * Short-lived signed URL for a released item's ciphertext blob. Verifies the
 * file belongs to an item released to this contact. Routes through the storage
 * abstraction (never ctx.storage.* directly).
 */
export const getMemorialItemFileUrl = query({
  args: {
    contactId: v.id("trusted_contacts"),
    fileId: v.id("vault_item_files"),
  },
  handler: async (ctx, args) => {
    const access = await resolveApprovedRelease(ctx, args.contactId);
    if (!access) return null;

    const file = await ctx.db.get(args.fileId);
    if (!file || !access.itemIds.includes(file.itemId)) return null;

    return await getBlobDownloadUrl(ctx, file.storageId);
  },
});
