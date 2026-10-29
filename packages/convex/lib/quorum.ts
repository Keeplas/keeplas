import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Count the unreachability votes behind a set of trusted-contact rows: the
 * DISTINCT humans, never the rows (C1). The same person invited via two
 * channels gets two rows but counts as a single vote. Only rows still
 * `accepted` count: a contact the owner revoked after voting no longer
 * speaks for them. Shared by the vote (access_requests.markUserUnreachable)
 * and the release re-check (life_check.releaseAfterConfirmation).
 */
export async function countQuorumVotes(
  ctx: QueryCtx,
  contactIds: Id<"trusted_contacts">[],
): Promise<number> {
  const people = new Set<string>();
  for (const contactId of contactIds) {
    const contact = await ctx.db.get(contactId);
    if (contact?.contactUserId && contact.invitationStatus === "accepted") {
      people.add(contact.contactUserId);
    }
  }
  return people.size;
}
