import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy } from "./lib";
import { batchPage } from "../lib/batch";

/** Most audit entries the per-action breakdown counts. */
const AUDIT_BREAKDOWN_ENTRIES = 5000;

/** The 50 most recent audit-log entries (newest first). Metadata/hashes are
 * intentionally omitted — the console only surfaces action + actor + geo. */
export const recentAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const logs = await ctx.db.query("audit_logs").order("desc").take(50);
    return logs.map((l) => ({
      _id: l._id,
      createdAt: l.createdAt,
      action: l.action,
      actorType: l.actorType,
      country: l.country ?? null,
      ipAddress: l.ipAddress ?? null,
    }));
  },
});

/**
 * Audit-event counts grouped by action name, over the most recent entries:
 * every audited call by any user adds one, so the whole table outgrows what
 * a query may read. One page, capped in rows and bytes (lib/batch.ts).
 */
export const auditByAction = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const { page } = await ctx.db
      .query("audit_logs")
      .order("desc")
      .paginate(batchPage(AUDIT_BREAKDOWN_ENTRIES, undefined));
    return countBy(page, (l) => l.action);
  },
});

/** Access-request totals + status breakdown. */
export const accessRequestStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db.query("access_requests").collect();
    return {
      total: requests.length,
      byStatus: countBy(requests, (r) => r.status),
    };
  },
});

/** Support-ticket totals broken down by topic and status. */
export const supportTicketStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tickets = await ctx.db.query("support_tickets").collect();
    return {
      total: tickets.length,
      byTopic: countBy(tickets, (t) => t.topic),
      byStatus: countBy(tickets, (t) => t.status),
    };
  },
});
