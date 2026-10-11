import { v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy, countWhere, seriesByDay } from "./lib";

const DAY_MS = 24 * 60 * 60 * 1000;
// Cap the window so table scans stay bounded as analytics_events grows. The
// admin UI only offers windows within this range.
const MAX_LOOKBACK_DAYS = 90;

// Every analytics query accepts the same optional `days` window.
const windowArgs = { days: v.optional(v.number()) } as const;

// Clamp the requested window to [1, MAX_LOOKBACK_DAYS] days and return the
// cutoff timestamp. Guards against unbounded scans and bad client input.
function sinceFrom(days?: number): number {
  const clamped = Math.min(
    Math.max(Math.floor(days ?? MAX_LOOKBACK_DAYS), 1),
    MAX_LOOKBACK_DAYS,
  );
  return Date.now() - clamped * DAY_MS;
}

// Page-view events within the window, read off the (eventType, createdAt) index.
async function pageViewsSince(ctx: QueryCtx, since: number) {
  return ctx.db
    .query("analytics_events")
    .withIndex("by_type_created", (q) =>
      q.eq("eventType", "page_view").gte("createdAt", since),
    )
    .collect();
}

/** Daily page-view series over the window, ascending by day. */
export const pageViewsOverTime = query({
  args: windowArgs,
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const events = await pageViewsSince(ctx, sinceFrom(days));
    return seriesByDay(events, (e) => e.createdAt);
  },
});

/** Page-view counts grouped by route template over the window. */
export const topRoutes = query({
  args: windowArgs,
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const events = await pageViewsSince(ctx, sinceFrom(days));
    return countBy(events, (e) => e.route);
  },
});

/** Page-view counts grouped by server-attested country (ISO-2) over the window. */
export const viewsByCountry = query({
  args: windowArgs,
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const events = await pageViewsSince(ctx, sinceFrom(days));
    return countBy(events, (e) => e.country);
  },
});

/**
 * Split page views by auth state over the window: `authenticated` when the event
 * carries a userId (post-login pages), `anonymous` otherwise (auth/onboarding).
 */
export const viewsByAuthState = query({
  args: windowArgs,
  handler: async (ctx, { days }) => {
    await requireAdmin(ctx);
    const events = await pageViewsSince(ctx, sinceFrom(days));
    return {
      authenticated: countWhere(events, (e) => e.userId !== undefined),
      anonymous: countWhere(events, (e) => e.userId === undefined),
    };
  },
});
