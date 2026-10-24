import { describe, it, expect, beforeAll } from "vitest";
import { makeT, seedUser, type TestConvex } from "./test.helpers";

// RevenueCat posts store (App Store / Play) purchase events to
// /webhooks/revenuecat with the Authorization header configured in its
// dashboard. A Lifetime purchase flips the buyer's plan exactly once.

const SECRET = "rc_test_webhook_secret";

function post(t: TestConvex, event: Record<string, unknown>, auth?: string) {
  return t.fetch("/webhooks/revenuecat", {
    method: "POST",
    headers: { authorization: auth ?? `Bearer ${SECRET}` },
    body: JSON.stringify({ api_version: "1.0", event }),
  });
}

function purchase(appUserId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "NON_RENEWING_PURCHASE",
    id: "evt_1",
    app_user_id: appUserId,
    product_id: "keeplas_lifetime",
    entitlement_ids: ["lifetime"],
    transaction_id: "2000000123",
    price: 99,
    price_in_purchased_currency: 179.99,
    currency: "EUR",
    store: "APP_STORE",
    environment: "PRODUCTION",
    ...overrides,
  };
}

function storePayments(t: TestConvex, transactionId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_revenuecat_transaction", (q) =>
        q.eq("revenueCatTransactionId", transactionId),
      )
      .collect(),
  );
}

describe("POST /webhooks/revenuecat", () => {
  beforeAll(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  });

  it("rejects a request without the shared secret", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    const res = await post(t, purchase(userId), "Bearer wrong");

    expect(res.status).toBe(401);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.plan).toBeUndefined();
  });

  it("upgrades the buyer and records the payment in USD", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    const res = await post(t, purchase(userId));

    expect(res.status).toBe(200);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.plan).toBe("lifetime");

    const payments = await storePayments(t, "2000000123");
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      userId,
      amountCents: 9900,
      currency: "usd",
      plan: "lifetime",
      status: "paid",
    });
  });

  it("is idempotent across a redelivered event", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    expect((await post(t, purchase(userId))).status).toBe(200);
    expect((await post(t, purchase(userId))).status).toBe(200);

    expect(await storePayments(t, "2000000123")).toHaveLength(1);
  });

  it("grants sandbox purchases (App Review) without counting revenue", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    await post(t, purchase(userId, { environment: "SANDBOX" }));

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.plan).toBe("lifetime");
    const [payment] = await storePayments(t, "2000000123");
    expect(payment?.amountCents).toBe(0);
  });

  it("ignores purchases that do not carry the lifetime entitlement", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    await post(t, purchase(userId, { entitlement_ids: [] }));

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.plan).toBeUndefined();
  });

  it("acknowledges an anonymous or unknown app user without failing", async () => {
    const t = makeT();

    const res = await post(t, purchase("$RCAnonymousID:abc"));

    expect(res.status).toBe(200);
    expect(await storePayments(t, "2000000123")).toHaveLength(0);
  });

  it("grants Lifetime to the account a purchase is restored onto", async () => {
    const t = makeT();
    const from = await seedUser(t);
    const to = await seedUser(t);

    const res = await post(t, {
      type: "TRANSFER",
      id: "evt_transfer",
      transferred_from: [from],
      transferred_to: [to, "$RCAnonymousID:abc"],
    });

    expect(res.status).toBe(200);
    const user = await t.run((ctx) => ctx.db.get(to));
    expect(user?.plan).toBe("lifetime");
  });
});
