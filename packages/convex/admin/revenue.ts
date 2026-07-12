import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { seriesByDay } from "./lib";

/** Daily revenue series (summed cents per UTC day), ascending by day. */
export const revenueOverTime = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("payments").collect();
    return seriesByDay(
      payments,
      (p) => p.createdAt,
      (p) => p.amountCents,
    ).map(({ day, value }) => ({ day, amountCents: value }));
  },
});

/** Payment count + total cents collected per currency. */
export const revenueTotals = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("payments").collect();
    const byCurrency: Record<string, number> = {};
    for (const p of payments) {
      byCurrency[p.currency] = (byCurrency[p.currency] ?? 0) + p.amountCents;
    }
    return { count: payments.length, byCurrency };
  },
});

/** The 20 most recent payments (newest first). */
export const recentPayments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("payments").order("desc").take(20);
    return payments.map((p) => ({
      _id: p._id,
      createdAt: p.createdAt,
      plan: p.plan,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
    }));
  },
});
