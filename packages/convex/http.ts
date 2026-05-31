import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { constantTimeStringEquals } from "./lib/crypto";

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

export default http;
