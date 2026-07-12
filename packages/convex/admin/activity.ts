import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy } from "./lib";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Active-user counts derived from `users.lastSeenAt` (refreshed by the throttled
 * page-view heartbeat in analytics.ts). Windows are rolling: daily = 24h,
 * weekly = 7d, monthly = 30d. Uses the `by_last_seen` index to read only users
 * seen within the widest window.
 */
export const activeUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const monthAgo = now - 30 * DAY_MS;

    const recent = await ctx.db
      .query("users")
      .withIndex("by_last_seen", (q) => q.gte("lastSeenAt", monthAgo))
      .collect();

    let daily = 0;
    let weekly = 0;
    for (const u of recent) {
      const seen = u.lastSeenAt ?? 0;
      if (seen >= now - DAY_MS) daily++;
      if (seen >= now - 7 * DAY_MS) weekly++;
    }
    return { daily, weekly, monthly: recent.length };
  },
});

/** Vault-item totals + a status breakdown. */
export const vaultItemStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("vault_items").collect();
    return { total: items.length, byStatus: countBy(items, (i) => i.status) };
  },
});

/** Trusted-contact totals broken down by invitation status, role, and type. */
export const trustedContactStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const contacts = await ctx.db.query("trusted_contacts").collect();
    return {
      total: contacts.length,
      byStatus: countBy(contacts, (c) => c.invitationStatus),
      byRole: countBy(contacts, (c) => c.role),
      byType: countBy(contacts, (c) => c.contactType, "unset"),
    };
  },
});

/** Life-check cycle breakdown by status. */
export const lifeCheckStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const cycles = await ctx.db.query("life_check_cycles").collect();
    return { byStatus: countBy(cycles, (c) => c.status) };
  },
});

/** Life-check config totals: how many configs exist, how many are active, and
 * their frequency mix. */
export const lifeCheckConfigStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("life_check_configs").collect();
    return {
      total: configs.length,
      active: configs.filter((c) => c.isActive).length,
      byFrequency: countBy(configs, (c) => c.frequency),
    };
  },
});

/** Total number of recipient groups. */
export const recipientGroupCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db.query("recipient_groups").collect();
    return { total: groups.length };
  },
});

/** Total number of Web Push subscriptions. */
export const pushSubscriptionCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const subs = await ctx.db.query("push_subscriptions").collect();
    return { total: subs.length };
  },
});
