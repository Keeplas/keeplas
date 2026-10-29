import { describe, it, expect, beforeAll } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { asUser, makeT, seedUser, type TestConvex } from "./test.helpers";

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

  it("moves Lifetime to the account a purchase is restored onto", async () => {
    const t = makeT();
    const from = await seedUser(t);
    const to = await seedUser(t);
    await post(t, purchase(from));

    const res = await post(t, transfer([from], [to, "$RCAnonymousID:abc"]));

    expect(res.status).toBe(200);
    expect(await planOf(t, to)).toBe("lifetime");
    expect(await planOf(t, from)).toBe("free");
  });

  it("grants nothing when the transferred-from account never held Lifetime", async () => {
    const t = makeT();
    const from = await seedUser(t);
    const to = await seedUser(t);

    await post(t, transfer([from], [to]));

    expect(await planOf(t, to)).toBeUndefined();
  });

  it("still moves Lifetime away from a buyer whose account was deleted", async () => {
    const t = makeT();
    const from = await seedUser(t);
    const to = await seedUser(t);
    await post(t, purchase(from));
    await t.run((ctx) => ctx.db.delete(from));

    await post(t, transfer([from], [to]));

    expect(await planOf(t, to)).toBe("lifetime");
  });

  it("revokes Lifetime when the purchase is refunded", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await post(t, purchase(userId));

    const res = await post(t, refund(userId));

    expect(res.status).toBe(200);
    expect(await planOf(t, userId)).toBe("free");
    const [payment] = await storePayments(t, "2000000123");
    expect(payment?.status).toBe("refunded");
    const actions = await auditActions(t, userId);
    expect(actions).toContain("billing.plan_downgraded");
  });

  it("keeps Lifetime when another purchase of the account still stands", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await post(t, purchase(userId));
    await post(
      t,
      purchase(userId, { transaction_id: "GPA.0001", store: "PLAY_STORE" }),
    );

    await post(t, refund(userId));

    expect(await planOf(t, userId)).toBe("lifetime");
  });

  it("ignores a cancellation that does not carry the lifetime entitlement", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await post(t, purchase(userId));

    await post(t, refund(userId, { entitlement_ids: [] }));

    expect(await planOf(t, userId)).toBe("lifetime");
    const [payment] = await storePayments(t, "2000000123");
    expect(payment?.status).toBe("paid");
  });

  it("grants Lifetime again when the refund is reversed", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await post(t, purchase(userId));
    await post(t, refund(userId));

    await post(t, refund(userId, { type: "REFUND_REVERSED" }));

    expect(await planOf(t, userId)).toBe("lifetime");
    const [payment] = await storePayments(t, "2000000123");
    expect(payment?.status).toBe("paid");
  });

  it("leaves a refunded purchase out of the revenue totals", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const admin = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(admin, { role: "admin" }));
    await post(t, purchase(userId));
    await post(t, refund(userId));

    const totals = await asUser(t, admin).query(
      api.admin.revenue.revenueTotals,
      {},
    );
    expect(totals).toEqual({ count: 0, byCurrency: {} });
  });

  it("does not grant Lifetime again on a purchase redelivered after its refund", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await post(t, purchase(userId));
    await post(t, refund(userId));

    await post(t, purchase(userId));

    expect(await planOf(t, userId)).toBe("free");
  });
});

function transfer(from: string[], to: string[]) {
  return {
    type: "TRANSFER",
    id: "evt_transfer",
    store: "APP_STORE",
    environment: "PRODUCTION",
    transferred_from: from,
    transferred_to: to,
  };
}

function refund(appUserId: string, overrides: Record<string, unknown> = {}) {
  return purchase(appUserId, {
    type: "CANCELLATION",
    id: "evt_refund",
    cancel_reason: "CUSTOMER_SUPPORT",
    ...overrides,
  });
}

async function planOf(t: TestConvex, userId: Id<"users">) {
  return (await t.run((ctx) => ctx.db.get(userId)))?.plan;
}

async function auditActions(t: TestConvex, userId: Id<"users">) {
  const logs = await t.run((ctx) =>
    ctx.db
      .query("audit_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
  return logs.map((log) => log.action);
}
