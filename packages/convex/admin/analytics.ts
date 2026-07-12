import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy, seriesByDay } from "./lib";

// Only look back this far so the scans stay bounded as analytics_events grows.
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

/** Daily page-view series over the last 90 days, ascending by day. */
export const pageViewsOverTime = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const since = Date.now() - LOOKBACK_MS;
    const events = await ctx.db
      .query("analytics_events")
      .withIndex("by_type_created", (q) =>
        q.eq("eventType", "page_view").gte("createdAt", since),
      )
      .collect();
    return seriesByDay(events, (e) => e.createdAt);
  },
});

/** Page-view counts grouped by route template over the last 90 days. */
export const topRoutes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const since = Date.now() - LOOKBACK_MS;
    const events = await ctx.db
      .query("analytics_events")
      .withIndex("by_type_created", (q) =>
        q.eq("eventType", "page_view").gte("createdAt", since),
      )
      .collect();
    return countBy(events, (e) => e.route);
  },
});
