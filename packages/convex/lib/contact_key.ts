import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Publish a contact's key material onto every owner's `trusted_contacts` row
 * where they are the accepted contact (`contactUserId === contactUserId`).
 *
 * This closes the gap where a contact accepts an invitation BEFORE their crypto
 * is ready: `acceptInvitation` then stores `contactPublicKey: undefined`, and
 * the owner cannot wrap a shard/DEK to them. The moment the contact finalizes
 * their keypair (`users.setPublicKey`) — or re-publishes from `/shared-with-me`
 * (`republishContactPublicKey`) — this backfills every owner's row so the
 * owner's reactive re-wrap (`getItemsNeedingRewrap`) can grant access.
 *
 * Idempotent: a row already holding the same three fields is skipped, so it is
 * safe to call on every key set / rotation. Returns the number of rows patched.
 */
export async function publishContactKeyToOwnerRows(
  ctx: MutationCtx,
  contactUserId: Id<"users">,
  material: {
    contactPublicKey: string;
    contactIdentityPublicKey?: string;
    contactPublicKeySignature?: string;
  },
): Promise<number> {
  const rows = await ctx.db
    .query("trusted_contacts")
    .withIndex("by_contact_user", (q) => q.eq("contactUserId", contactUserId))
    .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
    .collect();

  let patched = 0;
  for (const row of rows) {
    if (
      row.contactPublicKey === material.contactPublicKey &&
      row.contactIdentityPublicKey === material.contactIdentityPublicKey &&
      row.contactPublicKeySignature === material.contactPublicKeySignature
    ) {
      continue;
    }
    await ctx.db.patch(row._id, {
      contactPublicKey: material.contactPublicKey,
      contactIdentityPublicKey: material.contactIdentityPublicKey,
      contactPublicKeySignature: material.contactPublicKeySignature,
      updatedAt: Date.now(),
    });
    patched++;
  }
  return patched;
}
