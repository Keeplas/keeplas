import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, resolveItemRecipients } from "./helpers";
import { createAuditLog } from "./audit";
import { createNotification } from "./helpers";

/**
 * Run the per-recipient release fan-out for a user. For each active vault
 * item, resolve the effective recipient set, then create one access_requests
 * row per recipient with sectionsRequested listing the item IDs that
 * recipient is allowed to see. Recipients pull matching wrapped DEKs from
 * vault_item_recipient_keys and decrypt client-side.
 *
 * Idempotent: existing approved auto-release rows for the same vault user
 * are not duplicated.
 */
async function fanOutRelease(
  ctx: any,
  userId: Id<"users">,
  reason: string,
): Promise<{
  recipientsReached: number;
  itemsDistributed: number;
  requestsCreated: number;
}> {
  const items = await ctx.db
    .query("vault_items")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) =>
      q.and(
        q.neq(q.field("status"), "archived"),
        q.neq(q.field("accessLevel"), "private"),
      ),
    )
    .collect();

  const perRecipient = new Map<Id<"trusted_contacts">, Id<"vault_items">[]>();

  for (const item of items) {
    const recipients = await resolveItemRecipients(ctx, item, userId);
    for (const cid of recipients) {
      const list = perRecipient.get(cid) ?? [];
      list.push(item._id);
      perRecipient.set(cid, list);
    }
  }

  const now = Date.now();
  let requestsCreated = 0;

  for (const [contactId, itemIds] of perRecipient.entries()) {
    // Idempotency: skip only if a prior PER-RECIPIENT release (a row carrying
    // `item:` sections) already exists. The recovery-quorum request uses the
    // `["all"]` sentinel and gets flipped to "approved" by releaseAfterConfirmation
    // for the contacts who confirmed unreachability — it must NOT shadow the
    // release fan-out, or those contacts would never receive their item list.
    const approved = await ctx.db
      .query("access_requests")
      .withIndex("by_requester", (q: any) => q.eq("requestedBy", contactId))
      .filter((q: any) => q.eq(q.field("status"), "approved"))
      .collect();
    const alreadyReleased = approved.some((r: any) =>
      r.sectionsRequested.some((s: string) => s.startsWith("item:")),
    );

    if (alreadyReleased) continue;

    await ctx.db.insert("access_requests", {
      vaultUserId: userId,
      requestedBy: contactId,
      sectionsRequested: itemIds.map((id) => `item:${id}`),
      status: "approved",
      respondedAt: now,
      autoResponseAt: now,
      accessType: "read",
      createdAt: now,
      updatedAt: now,
      reason,
    });
    requestsCreated++;

    const contact = await ctx.db.get(contactId);
    if (contact?.contactUserId) {
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "access_request",
        title: "Vault released to you",
        body: `You've been granted read access to ${itemIds.length} item${itemIds.length === 1 ? "" : "s"} from a vault you are a recipient of.`,
        actionUrl: "/shared-with-me",
        channels: ["push", "email"],
        relatedType: "access_request",
      });
    }
  }

  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "release",
    action: "vault_released",
    resourceType: "user",
    resourceId: userId,
    metadata: JSON.stringify({
      reason,
      recipients: perRecipient.size,
      items: items.length,
      requestsCreated,
    }),
  });

  return {
    recipientsReached: perRecipient.size,
    itemsDistributed: items.length,
    requestsCreated,
  };
}

/**
 * Internal trigger callable from scenario execution / life_check escalation.
 */
export const triggerRelease = internalMutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    return await fanOutRelease(ctx, args.userId, args.reason);
  },
});

/**
 * Test-only: lets the vault owner manually fire a release on themselves
 * to verify the fan-out. Useful for QA before wiring into the real trigger.
 */
export const simulateEmergencyTrigger = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await fanOutRelease(ctx, userId, "manual_simulation");
  },
});

/**
 * Owner-facing preview: for each trusted contact, the items they'd receive (and
 * at what access level) if a release fired right now. Mirrors fanOutRelease's
 * resolution exactly, so the owner can verify "who gets what" before anything
 * is triggered. Read-only; touches no release state.
 */
export const getReleasePreview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "archived"),
          q.neq(q.field("accessLevel"), "private"),
        ),
      )
      .collect();

    const perContact = new Map<Id<"trusted_contacts">, string[]>();
    for (const item of items) {
      const recipients = await resolveItemRecipients(ctx, item, userId);
      for (const cid of recipients) {
        const titles = perContact.get(cid) ?? [];
        titles.push(item.title);
        perContact.set(cid, titles);
      }
    }

    const result = [];
    for (const [contactId, titles] of perContact.entries()) {
      const contact = await ctx.db.get(contactId);
      if (!contact) continue;
      result.push({
        contactId,
        name: contact.name,
        role: contact.role,
        itemCount: titles.length,
        itemTitles: titles.slice(0, 5),
        // The release fan-out grants read access (read-only) to each recipient.
        accessType: "read" as const,
      });
    }
    return result;
  },
});

/**
 * Cron entry point: release every active vault item with a time_based
 * trigger whose releaseDate has passed. Idempotent — flips status to
 * "released" so we never re-fire.
 */
export const processScheduledReleases = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const due = await ctx.db
      .query("vault_items")
      .withIndex("by_trigger", (q) =>
        q.eq("triggerType", "time_based").eq("status", "active"),
      )
      .collect();

    let released = 0;
    for (const item of due) {
      const releaseAt = item.triggerConfig?.releaseDate;
      if (!releaseAt || releaseAt > now) continue;

      await fanOutRelease(ctx, item.userId, `time_based:${item._id}`);

      await ctx.db.patch(item._id, {
        status: "released",
        releasedAt: now,
        updatedAt: now,
      });
      released++;
    }

    return { scanned: due.length, released };
  },
});
