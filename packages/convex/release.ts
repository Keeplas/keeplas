import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
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
  reason: string
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
        q.neq(q.field("accessLevel"), "private")
      )
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
    const existing = await ctx.db
      .query("access_requests")
      .withIndex("by_requester", (q: any) => q.eq("requestedBy", contactId))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("accessMode"), "mode_a")
        )
      )
      .first();

    if (existing) continue;

    await ctx.db.insert("access_requests", {
      vaultUserId: userId,
      requestedBy: contactId,
      accessMode: "mode_a",
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
        title: "Vault release",
        body: `You have access to ${itemIds.length} item${itemIds.length === 1 ? "" : "s"} from a vault you are a recipient of.`,
        actionUrl: "/trusted-contacts",
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
