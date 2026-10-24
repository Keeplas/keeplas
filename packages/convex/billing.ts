import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { createAuditLog } from "./audit";

/**
 * Flip a user to Lifetime and append the system audit entry. Shared by the
 * purchase and transfer fulfilment paths so the plan change and its audit
 * trail can never drift apart.
 */
async function grantLifetime(
  ctx: MutationCtx,
  userId: Id<"users">,
  audit: { resourceId: string; metadata: Record<string, unknown> },
) {
  await ctx.db.patch(userId, { plan: "lifetime", updatedAt: Date.now() });
  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "revenuecat",
    action: "billing.plan_upgraded",
    resourceType: "billing",
    resourceId: audit.resourceId,
    metadata: JSON.stringify({ plan: "lifetime", ...audit.metadata }),
  });
}

/**
 * Fulfil an in-app Lifetime purchase (App Store / Play) relayed by the
 * RevenueCat webhook (`http.ts`). The mobile app logs in to RevenueCat with the
 * Convex user id, so `appUserId` is that id — anything else (an anonymous
 * `$RCAnonymousID:…`, a deleted account) is acknowledged as `unknown_user` so
 * RevenueCat does not retry. Idempotent on the store transaction id.
 */
export const fulfillStorePurchase = internalMutation({
  args: {
    appUserId: v.string(),
    transactionId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<"already" | "fulfilled" | "unknown_user"> => {
    const userId = ctx.db.normalizeId("users", args.appUserId);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!userId || !user) return "unknown_user";

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_revenuecat_transaction", (q) =>
        q.eq("revenueCatTransactionId", args.transactionId),
      )
      .unique();
    if (existing) return "already";

    await ctx.db.insert("payments", {
      userId,
      revenueCatTransactionId: args.transactionId,
      amountCents: args.amountCents,
      currency: args.currency,
      plan: "lifetime",
      status: "paid",
      createdAt: Date.now(),
    });
    await grantLifetime(ctx, userId, {
      resourceId: args.transactionId,
      metadata: { amountCents: args.amountCents, currency: args.currency },
    });

    return "fulfilled";
  },
});

/**
 * Grant Lifetime to the accounts a store purchase was moved onto. RevenueCat
 * sends a `TRANSFER` when "Restore purchases" runs on a Keeplas account other
 * than the original buyer (new account on the same Apple / Google id). No
 * payment row — the money was recorded on the original purchase. Ids that are
 * not a live Convex user are skipped.
 */
export const grantStoreTransfer = internalMutation({
  args: { appUserIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const appUserId of args.appUserIds) {
      const userId = ctx.db.normalizeId("users", appUserId);
      const user = userId ? await ctx.db.get(userId) : null;
      if (!userId || !user || user.plan === "lifetime") continue;
      await grantLifetime(ctx, userId, {
        resourceId: userId,
        metadata: { via: "transfer" },
      });
    }
  },
});
