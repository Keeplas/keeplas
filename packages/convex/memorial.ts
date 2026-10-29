import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { approvedReleaseRequest, requireFullAuth } from "./helpers";
import { getBlobDownloadUrl } from "./lib/storage";
import { ownerDisplay } from "./lib/identity";

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
  // Single step-up chokepoint for every memorial read (5 queries route through
  // here — DRY). The viewing contact is a long-established account by release
  // time, so their login-OTP/TOTP gate is reliably clearable; this is steady-
  // state sensitive access to released ciphertext, not a just-signed-up path.
  const requesterId = await requireFullAuth(ctx);

  const contact = await ctx.db.get(contactId);
  if (!contact || contact.contactUserId !== requesterId) return null;

  // A contact with no `item:` release row is recovery-only (no items left to
  // them).
  const request = await approvedReleaseRequest(ctx, contactId);
  if (!request) return null;

  const itemIds = request.sectionsRequested
    .filter((s) => s.startsWith(ITEM_PREFIX))
    .map((s) => s.slice(ITEM_PREFIX.length) as Id<"vault_items">);

  return { contact, itemIds };
}

/**
 * The item when it was released to this contact and the owner still shares
 * it (not archived, not private), else null. Every memorial read goes through
 * it, so an item and its files can never disagree.
 */
async function releasedItem(
  ctx: QueryCtx,
  access: ApprovedRelease,
  itemId: Id<"vault_items">,
) {
  if (!access.itemIds.includes(itemId)) return null;
  const item = await ctx.db.get(itemId);
  if (!item || item.status === "archived" || item.accessLevel === "private") {
    return null;
  }
  return item;
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
  item: Doc<"vault_items">,
  contactId: Id<"trusted_contacts">,
) {
  const recRow = await ctx.db
    .query("vault_item_recipient_keys")
    .withIndex("by_item_contact", (q) =>
      q.eq("itemId", item._id).eq("contactId", contactId),
    )
    .first();

  const firstFile = await ctx.db
    .query("vault_item_files")
    .withIndex("by_item", (q) => q.eq("itemId", item._id))
    .first();

  return {
    _id: item._id,
    title: item.title,
    encryptedTitle: item.encryptedTitle,
    // Legacy plaintext category until backfilled; else sealed in
    // encryptedMeta under the item DEK (F4).
    category: item.category,
    encryptedMeta: item.encryptedMeta,
    encryptionType: item.encryptionType,
    encryptedContent: item.encryptedContent,
    encryptedLinks: item.encryptedLinks ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    wrappedDek: recRow?.wrappedDek ?? null,
    readable: item.encryptionType === "zero_knowledge" && !!recRow?.wrappedDek,
    hasFiles: firstFile !== null,
    isReleaseIntroduction: item.isReleaseIntroduction === true,
    recipientMode: item.recipientMode ?? "default",
  };
}

/**
 * The released vault as seen by a contact: owner display info + the list of
 * items released to them (encrypted, with each one's per-recipient wrapped DEK).
 *
 * Release introductions are split into their own bucket so the UI can render
 * them as a "message from the owner" above the categorized items. Targeting
 * applies an override rule: when at least one intro is specifically addressed
 * to this contact (recipientMode != "default"), the global ("default") intros
 * are hidden — the targeted one is meant to replace the generic welcome.
 */
export const getReleasedVaultForMe = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const access = await resolveApprovedRelease(ctx, args.contactId);
    if (!access) return null;

    const owner = ownerDisplay(await ctx.db.get(access.contact.userId));

    const items = [];
    const allIntros = [];
    for (const itemId of access.itemIds) {
      const item = await releasedItem(ctx, access, itemId);
      if (!item) continue;
      const shaped = await shapeItem(ctx, item, args.contactId);
      if (shaped.isReleaseIntroduction) {
        allIntros.push(shaped);
      } else {
        items.push(shaped);
      }
    }

    const targetedIntros = allIntros.filter(
      (i) => i.recipientMode !== "default",
    );
    const introductions =
      targetedIntros.length > 0 ? targetedIntros : allIntros;

    return { owner, items, introductions };
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
    if (!access) return null;
    const released = await releasedItem(ctx, access, args.itemId);
    if (!released) return null;

    const item = await shapeItem(ctx, released, args.contactId);
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
    if (!access || !(await releasedItem(ctx, access, args.itemId))) return [];

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
    if (!file || !(await releasedItem(ctx, access, file.itemId))) return null;

    return await getBlobDownloadUrl(ctx, file.storageId);
  },
});
