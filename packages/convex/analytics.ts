import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { optionalAuth } from "./helpers";
import { auditContextValidator, verifyAuditContext } from "./audit";

// How stale `users.lastSeenAt` must be before a page view refreshes it. Keeps
// the heartbeat to at most one write per user per window instead of one per
// navigation.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Record a product-analytics event (page view) emitted by the web app on
 * navigation. Consumed only by the keeplas-admin console.
 *
 * Deliberately a plain `mutation`, NOT `auditedMutation`: a page view is not an
 * auditable state change and must never pollute the tamper-evident audit chain.
 * It still reuses the sealed `_audit` envelope purely to obtain server-attested
 * IP + country (verified via `verifyAuditContext`), never trusting a
 * client-supplied value.
 *
 * `route` MUST be the matched route TEMPLATE (e.g. "/vault/$itemId"), never a
 * resolved path — see the analytics_events schema note (zero-knowledge).
 *
 * Works for logged-out visitors (auth / onboarding pages): `optionalAuth`
 * yields a null userId and the event is stored without one. When a user is
 * present, the same call doubles as a throttled `lastSeenAt` heartbeat, which
 * powers the admin "active users" metric.
 */
export const track = mutation({
  args: {
    eventType: v.union(v.literal("page_view"), v.literal("session_start")),
    route: v.string(),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);

    const userId = await optionalAuth(ctx);
    const now = Date.now();

    await ctx.db.insert("analytics_events", {
      userId: userId ?? undefined,
      eventType: args.eventType,
      route: args.route,
      ipAddress: args._audit.ip,
      country: args._audit.country,
      createdAt: now,
    });

    // Throttled liveness heartbeat. Only touches `users.lastSeenAt`; it must
    // NOT reset `life_check_configs.lastActivityAt`, which is explicit-liveness
    // only (in-app tap / email / WhatsApp reply — see life_check.ts).
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user && (user.lastSeenAt ?? 0) < now - LAST_SEEN_THROTTLE_MS) {
        await ctx.db.patch(userId, { lastSeenAt: now });
      }
    }
  },
});
