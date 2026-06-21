import { describe, it, expect, beforeAll } from "vitest";
import { makeT, seedUser } from "./test.helpers";

// Regression: a `payment`-mode Checkout session with no Customer object sends
// `customer: null` in `checkout.session.completed`. The webhook used to forward
// that null straight into `fulfillCheckout`, whose `v.optional(v.string())`
// validator rejects null → the httpAction threw → Stripe got a 500 and the
// buyer's plan was never flipped. The boundary now normalizes null → undefined.

const SECRET = "whsec_test_secret";

async function signHeader(payload: string, ts: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${ts}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

describe("POST /webhooks/stripe — checkout.session.completed", () => {
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  it("fulfils a paid session when Stripe sends customer: null", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          client_reference_id: userId,
          payment_intent: "pi_test_123",
          amount_total: 9900,
          currency: "usd",
          customer: null, // first-buyer: no Customer object created
          metadata: { userId },
        },
      },
    });

    const header = await signHeader(body, Math.floor(Date.now() / 1000));
    const res = await t.fetch("/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": header },
      body,
    });

    expect(res.status).toBe(200);

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.plan).toBe("lifetime");

    const payment = await t.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_session", (q) => q.eq("stripeSessionId", "cs_test_123"))
        .unique(),
    );
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe("paid");
    expect(payment?.amountCents).toBe(9900);
  });

  it("is idempotent across a redelivered event", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_dup",
          payment_status: "paid",
          client_reference_id: userId,
          amount_total: 9900,
          currency: "usd",
          customer: null,
        },
      },
    });

    const post = async () => {
      const header = await signHeader(body, Math.floor(Date.now() / 1000));
      return t.fetch("/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": header },
        body,
      });
    };

    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);

    const payments = await t.run((ctx) =>
      ctx.db
        .query("payments")
        .withIndex("by_session", (q) => q.eq("stripeSessionId", "cs_test_dup"))
        .collect(),
    );
    expect(payments).toHaveLength(1);
  });
});
