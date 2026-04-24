import { internalMutation } from "./_generated/server";

/**
 * One-shot backfill for the per-recipient release feature:
 *   - trusted_contacts.contactType → "trust"
 *   - vault_items.recipientMode    → "default"
 *   - vault_items.sharedWithGroups → []
 *   - per user, create a default recipient_group containing all current
 *     trust contacts (only if the user has no default group yet).
 *
 * Safe to re-run: every step skips rows already populated.
 */
export const migrateRecipients = internalMutation({
  args: {},
  handler: async (ctx) => {
    let contactsPatched = 0;
    let itemsPatched = 0;
    let groupsCreated = 0;

    const contacts = await ctx.db.query("trusted_contacts").collect();
    for (const c of contacts) {
      if (c.contactType === undefined) {
        await ctx.db.patch(c._id, { contactType: "trust", updatedAt: Date.now() });
        contactsPatched++;
      }
    }

    const items = await ctx.db.query("vault_items").collect();
    for (const item of items) {
      const patch: Record<string, unknown> = {};
      if (item.recipientMode === undefined) patch.recipientMode = "default";
      if (item.sharedWithGroups === undefined) patch.sharedWithGroups = [];
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await ctx.db.patch(item._id, patch);
        itemsPatched++;
      }
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const existingDefault = await ctx.db
        .query("recipient_groups")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();
      if (existingDefault) continue;

      const userTrustContacts = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
        .collect();

      const memberContactIds = userTrustContacts
        .filter((c) => (c.contactType ?? "trust") === "trust")
        .map((c) => c._id);

      const now = Date.now();
      await ctx.db.insert("recipient_groups", {
        userId: user._id,
        name: "All trust contacts",
        description: "Default group — every accepted trust contact.",
        memberContactIds,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      groupsCreated++;
    }

    return { contactsPatched, itemsPatched, groupsCreated };
  },
});
