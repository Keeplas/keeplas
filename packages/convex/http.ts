import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { constantTimeStringEquals } from "./lib/crypto";
import { verifyStripeSignature } from "./lib/stripe_webhook";
import { requireEnv } from "./lib/require_env";

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
 * Stripe webhook. Fulfils a paid one-time Lifetime Checkout: on
 * `checkout.session.completed` with `payment_status === "paid"` it flips the
 * referenced user to the `lifetime` plan (idempotently — see
 * `billing.fulfillCheckout`). All other event types are acknowledged with 200
 * so Stripe does not retry.
 *
 * Auth: the raw body is HMAC-verified against `STRIPE_WEBHOOK_SECRET` using the
 * `Stripe-Signature` header before any parsing. An invalid or stale signature
 * is rejected with 400.
 */
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // The signature is computed over the exact raw body — read text, verify,
    // then parse. Parsing first (and re-serializing) would break the HMAC.
    const raw = await request.text();
    const valid = await verifyStripeSignature(
      raw,
      request.headers.get("stripe-signature"),
      requireEnv("STRIPE_WEBHOOK_SECRET"),
    );
    if (!valid) {
      return new Response("invalid signature", { status: 400 });
    }

    let event: {
      type?: string;
      data?: {
        object?: {
          id?: string;
          payment_status?: string;
          client_reference_id?: string;
          payment_intent?: string;
          amount_total?: number;
          currency?: string;
          customer?: string;
          metadata?: { userId?: string };
        };
      };
    };
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("bad request", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const userId = session?.client_reference_id ?? session?.metadata?.userId;
      if (session?.payment_status === "paid" && userId) {
        await ctx.runMutation(internal.billing.fulfillCheckout, {
          userId: userId as Id<"users">,
          stripeSessionId: session.id ?? "",
          stripePaymentIntentId: session.payment_intent,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          stripeCustomerId: session.customer,
        });
      }
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
