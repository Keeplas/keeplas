import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./helpers";
import { requireEnv } from "./lib/require_env";
import { createAuditLog } from "./audit";

const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";

/**
 * Read the fields the Checkout action needs to pre-fill a Stripe session.
 * Internal — only `createCheckoutSession` (an action, which has no `ctx.db`)
 * calls it via `runQuery`.
 */
export const getCheckoutContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    return {
      email: user.email ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
    };
  },
});

/**
 * Create a hosted Stripe Checkout session for the one-time Lifetime purchase
 * and return its redirect URL. Mode is `payment` (no subscription). Guarded by
 * `requireAuth` only — the purchase is not ZK-sensitive and forcing the TOTP /
 * login-OTP step-up here would block a legitimate buyer mid-flow.
 *
 * The user's plan is NOT flipped here; that happens asynchronously when Stripe
 * POSTs `checkout.session.completed` to `/webhooks/stripe`
 * (-> `fulfillCheckout`). `client_reference_id` / `metadata.userId` carry the
 * identity across that webhook so fulfilment can find the right user.
 */
export const createCheckoutSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await requireAuth(ctx);
    const { email, stripeCustomerId } = await ctx.runQuery(
      internal.billing.getCheckoutContext,
      { userId },
    );

    const siteUrl = requireEnv("SITE_URL");
    const params = new URLSearchParams({
      mode: "payment",
      // Surface the "Add promotion code" field on the hosted Checkout page so a
      // buyer can redeem a Stripe promotion code against the Lifetime price.
      allow_promotion_codes: "true",
      "line_items[0][price]": requireEnv("STRIPE_PRICE_LIFETIME"),
      "line_items[0][quantity]": "1",
      client_reference_id: userId,
      "metadata[userId]": userId,
      "metadata[plan]": "lifetime",
      success_url: `${siteUrl}/settings/subscription?checkout=success`,
      cancel_url: `${siteUrl}/settings/subscription?checkout=cancel`,
    });
    // Reuse an existing Stripe customer when we have one; otherwise let Stripe
    // create one from the pre-filled email.
    if (stripeCustomerId) {
      params.set("customer", stripeCustomerId);
    } else if (email) {
      params.set("customer_email", email);
    }

    const res = await fetch(STRIPE_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe checkout ${res.status}: ${text.slice(0, 200)}`);
    }

    const session = (await res.json()) as { url?: string };
    if (!session.url) {
      throw new Error("Stripe checkout session returned no URL");
    }
    return { url: session.url };
  },
});

/**
 * Fulfil a paid one-time Checkout session: flip the user to `lifetime`, record
 * the payment, and append a system audit-log entry. Called only by the Stripe
 * webhook (`http.ts`). Idempotent — a re-delivered event for an already-stored
 * session is a no-op, so a webhook retry can never double-charge state.
 */
export const fulfillCheckout = internalMutation({
  args: {
    userId: v.id("users"),
    stripeSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    stripeCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_session", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique();
    if (existing) return;

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();
    await ctx.db.insert("payments", {
      userId: args.userId,
      stripeSessionId: args.stripeSessionId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      amountCents: args.amountCents,
      currency: args.currency,
      plan: "lifetime",
      status: "paid",
      createdAt: now,
    });

    await ctx.db.patch(args.userId, {
      plan: "lifetime",
      ...(args.stripeCustomerId
        ? { stripeCustomerId: args.stripeCustomerId }
        : {}),
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "system",
      actorId: "stripe",
      action: "billing.plan_upgraded",
      resourceType: "billing",
      resourceId: args.stripeSessionId,
      metadata: JSON.stringify({
        plan: "lifetime",
        amountCents: args.amountCents,
        currency: args.currency,
      }),
    });
  },
});
