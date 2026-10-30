import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { createAuditLog } from "./audit";
import type { Plan } from "./lib/plans";

/**
 * Set a user's plan and append the system audit entry. Shared by every
 * fulfilment path so the plan change and its audit trail can never drift
 * apart.
 */
async function setPlan(
  ctx: MutationCtx,
  userId: Id<"users">,
  plan: Plan,
  audit: { resourceId: string; metadata: Record<string, unknown> },
) {
  await ctx.db.patch(userId, { plan, updatedAt: Date.now() });
  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "revenuecat",
    action:
      plan === "lifetime" ? "billing.plan_upgraded" : "billing.plan_downgraded",
    resourceType: "billing",
    resourceId: audit.resourceId,
    metadata: JSON.stringify({ plan, ...audit.metadata }),
  });
}

/**
 * The live account behind a RevenueCat app user id (the Convex user id the
 * app logs in with), or null for anything else: an anonymous
 * `$RCAnonymousID:…` or a deleted account.
 */
async function storeUser(ctx: MutationCtx, appUserId: string) {
  const userId = ctx.db.normalizeId("users", appUserId);
  const user = userId ? await ctx.db.get(userId) : null;
  return userId && user ? { userId, user } : null;
}

function paymentOf(ctx: MutationCtx, transactionId: string) {
  return ctx.db
    .query("payments")
    .withIndex("by_revenuecat_transaction", (q) =>
      q.eq("revenueCatTransactionId", transactionId),
    )
    .unique();
}

/** Whether the account has a Lifetime purchase that was not refunded. */
async function hasPaidPurchase(
  ctx: MutationCtx,
  userId: Id<"users">,
  exceptTransactionId?: string,
) {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return payments.some(
    (p) =>
      p.status === "paid" && p.revenueCatTransactionId !== exceptTransactionId,
  );
}

/**
 * Fulfil an in-app Lifetime purchase (App Store / Play) relayed by the
 * RevenueCat webhook (`http.ts`). The mobile app logs in to RevenueCat with the
 * Convex user id, so `appUserId` is that id — anything else (an anonymous
 * `$RCAnonymousID:…`, a deleted account) is acknowledged as `unknown_user` so
 * RevenueCat does not retry. Idempotent on the store transaction id, so a
 * purchase redelivered after its refund grants nothing.
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
    const buyer = await storeUser(ctx, args.appUserId);
    if (!buyer) return "unknown_user";
    if (await paymentOf(ctx, args.transactionId)) return "already";

    await ctx.db.insert("payments", {
      userId: buyer.userId,
      revenueCatTransactionId: args.transactionId,
      amountCents: args.amountCents,
      currency: args.currency,
      plan: "lifetime",
      status: "paid",
      createdAt: Date.now(),
    });
    await setPlan(ctx, buyer.userId, "lifetime", {
      resourceId: args.transactionId,
      metadata: { amountCents: args.amountCents, currency: args.currency },
    });

    return "fulfilled";
  },
});

/**
 * The store refunded a Lifetime purchase (RevenueCat `CANCELLATION`): mark it
 * refunded and put its current holder (`appUserId`, who may have restored it
 * from the buyer) back on Free, unless another of their purchases stands.
 */
export const refundStorePurchase = internalMutation({
  args: { appUserId: v.string(), transactionId: v.string() },
  handler: async (ctx, args) => {
    const payment = await paymentOf(ctx, args.transactionId);
    if (payment?.status === "paid") {
      await ctx.db.patch(payment._id, { status: "refunded" });
    }
    const holder = await storeUser(ctx, args.appUserId);
    if (!holder || holder.user.plan !== "lifetime") return;
    if (await hasPaidPurchase(ctx, holder.userId, args.transactionId)) return;
    await setPlan(ctx, holder.userId, "free", {
      resourceId: args.transactionId,
      metadata: { via: "refund" },
    });
  },
});

/** Apple reversed a refund (`REFUND_REVERSED`): the purchase stands again. */
export const reinstateStorePurchase = internalMutation({
  args: { appUserId: v.string(), transactionId: v.string() },
  handler: async (ctx, args) => {
    const payment = await paymentOf(ctx, args.transactionId);
    if (payment?.status === "refunded") {
      await ctx.db.patch(payment._id, { status: "paid" });
    }
    const holder = await storeUser(ctx, args.appUserId);
    if (!holder || holder.user.plan === "lifetime") return;
    await setPlan(ctx, holder.userId, "lifetime", {
      resourceId: args.transactionId,
      metadata: { via: "refund_reversed" },
    });
  },
});

/**
 * Move Lifetime between accounts. RevenueCat sends a `TRANSFER` when "Restore
 * purchases" runs on a Keeplas account other than the one holding the store
 * purchase (same Apple / Google id): the purchase leaves `fromAppUserIds` for
 * `toAppUserIds`. The event names no product, so Lifetime moves only when a
 * source held it (its plan, or a standing payment for a deleted buyer). No
 * payment row: the money was recorded on the original purchase.
 */
export const transferStorePurchase = internalMutation({
  args: {
    fromAppUserIds: v.array(v.string()),
    toAppUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let held = false;
    for (const appUserId of args.fromAppUserIds) {
      const source = await storeUser(ctx, appUserId);
      if (source) {
        if (source.user.plan !== "lifetime") continue;
        held = true;
        await setPlan(ctx, source.userId, "free", {
          resourceId: source.userId,
          metadata: { via: "transfer" },
        });
      } else {
        // A deleted buyer: their standing payment shows they held it.
        const userId = ctx.db.normalizeId("users", appUserId);
        if (userId && (await hasPaidPurchase(ctx, userId))) held = true;
      }
    }
    if (!held) return;

    for (const appUserId of args.toAppUserIds) {
      const target = await storeUser(ctx, appUserId);
      if (!target || target.user.plan === "lifetime") continue;
      await setPlan(ctx, target.userId, "lifetime", {
        resourceId: target.userId,
        metadata: { via: "transfer" },
      });
    }
  },
});
