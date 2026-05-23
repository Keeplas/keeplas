import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { verifyLifeCheckToken } from "./lib/life_check_token";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * One-click Life Check confirmation from the check-in email. Unauthenticated
 * by design: the HMAC-signed token (see lib/life_check_token.ts) proves the
 * link came from a real check-in email, so the user can confirm from any
 * device without logging in. The token only resets a liveness timer — it never
 * exposes vault data. Always 302-redirects to a friendly landing page.
 */
http.route({
  path: "/life-check/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const appUrl = process.env.APP_URL ?? "";
    const redirect = (status: "ok" | "invalid") =>
      new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/life-check/confirm?status=${status}` },
      });

    const token = new URL(request.url).searchParams.get("token");
    if (!token) return redirect("invalid");

    const payload = await verifyLifeCheckToken(token);
    if (!payload) return redirect("invalid");

    await ctx.runMutation(internal.life_check.confirmFromEmail, {
      cycleId: payload.cycleId as Id<"life_check_cycles">,
      userId: payload.userId as Id<"users">,
    });
    return redirect("ok");
  }),
});

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
    if (!secret || request.headers.get("x-keeplas-webhook-secret") !== secret) {
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
