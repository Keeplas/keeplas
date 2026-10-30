import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { constantTimeStringEquals } from "./lib/crypto";
import { requireEnv } from "./lib/require_env";
import { LIFETIME_ENTITLEMENT_ID } from "./lib/plans";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Infobip inbound WhatsApp webhook. A free-text reply or a Quick-reply
 * button tap from the user counts as a deliberate liveness signal and
 * validates any in-flight Life Check cycle — without the user opening the
 * app. Delivery reports / read receipts are intentionally NOT consumed here
 * (a read receipt is too weak to mean "alive" for a dead-man's-switch).
 *
 * Auth: Infobip is configured to forward inbound messages with a shared
 * secret in the `x-keeplas-webhook-secret` header. Requests without the
 * matching `INFOBIP_INBOUND_SECRET` are rejected with 401. Unknown senders
 * are a silent no-op (200) so the provider does not retry.
 */
http.route({
  path: "/webhooks/infobip/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.INFOBIP_INBOUND_SECRET;
    const provided = request.headers.get("x-keeplas-webhook-secret");
    if (!secret || !provided || !constantTimeStringEquals(provided, secret)) {
      return new Response("unauthorized", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    const results = (payload as { results?: { from?: string }[] })?.results;
    if (!Array.isArray(results)) {
      return new Response(null, { status: 200 });
    }

    // Infobip delivers `from` as digits without a leading "+"; stored numbers
    // are E.164 (`+CC…`). Normalize before the indexed lookup.
    const phones = new Set(
      results
        .map((r) => r.from?.trim())
        .filter((f): f is string => !!f)
        .map((f) => (f.startsWith("+") ? f : `+${f}`)),
    );

    for (const phoneNumber of phones) {
      await ctx.runMutation(internal.life_check.validateFromWhatsApp, {
        phoneNumber,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

/**
 * RevenueCat webhook. Keeps the Lifetime plan in step with the store
 * (`app_user_id` = Convex user id), each event idempotent — see billing.ts:
 * - `NON_RENEWING_PURCHASE` with the Lifetime entitlement grants the buyer;
 * - `CANCELLATION` (a refund, for a one-time purchase) or `EXPIRATION` of it
 *   revokes it, and `REFUND_REVERSED` grants it again;
 * - `TRANSFER` (purchase restored onto another account) moves it from
 *   `transferred_from` to `transferred_to`.
 * All other event types, including the dashboard's `TEST`, are acknowledged
 * with 200 so RevenueCat does not retry.
 *
 * Amounts are stored in USD (`price`, RevenueCat's converted price) so the
 * admin revenue totals stay comparable across storefront currencies. Sandbox
 * purchases (App Review, TestFlight) still unlock the plan but are recorded at
 * 0 so they never count as revenue.
 *
 * Auth: the dashboard sends `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.
 * Any other value is rejected with 401.
 */
http.route({
  path: "/webhooks/revenuecat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = requireEnv("REVENUECAT_WEBHOOK_SECRET");
    const provided = request.headers.get("authorization");
    if (!provided || !constantTimeStringEquals(provided, `Bearer ${secret}`)) {
      return new Response("unauthorized", { status: 401 });
    }

    let event: {
      type?: string;
      app_user_id?: string;
      transaction_id?: string;
      entitlement_ids?: string[] | null;
      price?: number;
      environment?: string;
      transferred_from?: string[];
      transferred_to?: string[];
    };
    try {
      event = ((await request.json()) as { event?: typeof event }).event ?? {};
    } catch {
      return new Response("bad request", { status: 400 });
    }

    const lifetime =
      event.entitlement_ids?.includes(LIFETIME_ENTITLEMENT_ID) &&
      event.app_user_id &&
      event.transaction_id
        ? { appUserId: event.app_user_id, transactionId: event.transaction_id }
        : null;

    if (event.type === "NON_RENEWING_PURCHASE" && lifetime) {
      await ctx.runMutation(internal.billing.fulfillStorePurchase, {
        ...lifetime,
        amountCents:
          event.environment === "SANDBOX"
            ? 0
            : Math.round((event.price ?? 0) * 100),
        currency: "usd",
      });
    } else if (
      (event.type === "CANCELLATION" || event.type === "EXPIRATION") &&
      lifetime
    ) {
      await ctx.runMutation(internal.billing.refundStorePurchase, lifetime);
    } else if (event.type === "REFUND_REVERSED" && lifetime) {
      await ctx.runMutation(internal.billing.reinstateStorePurchase, lifetime);
    } else if (event.type === "TRANSFER" && event.transferred_to?.length) {
      await ctx.runMutation(internal.billing.transferStorePurchase, {
        fromAppUserIds: event.transferred_from ?? [],
        toAppUserIds: event.transferred_to,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
