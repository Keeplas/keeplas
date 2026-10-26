import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  seedTrustContact,
  seedUser,
  type TestConvex,
} from "./test.helpers";

const DEMO_PHONE = "+12025550101";
const SIGNUP_PHONE = "+12025550104";
const REAL_PHONE = "+33612345678";

async function seedPhoneUser(t: TestConvex, phoneNumber: string) {
  const userId = await seedUser(t);
  await t.run((ctx) => ctx.db.patch(userId, { phoneNumber }));
  return userId;
}

async function seedDemoOwner(t: TestConvex): Promise<Id<"users">> {
  const userId = await seedPhoneUser(t, DEMO_PHONE);
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, {
      name: "Demo Owner",
      plan: "free",
      recoveryPhraseHash: "verifier",
    });
    await ctx.db.insert("life_check_configs", {
      userId,
      frequency: "quarterly",
      activeChannels: [],
      travelModeEnabled: true,
      isActive: true,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });
  await seedTrustContact(t, userId, { n: 1 });
  await seedTrustContact(t, userId, { n: 2 });
  return userId;
}

describe("store review status", () => {
  afterEach(() => {
    delete process.env.REVIEW_PHONES;
    delete process.env.REVIEW_CODE;
  });

  it("reports each review number's readiness without the code", async () => {
    process.env.REVIEW_PHONES = "+1 202 555 0101, +1 202 555 0104";
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await seedDemoOwner(t);

    const report = await t.query(internal.store_review.status, {});

    expect(report).toEqual({
      code: "set",
      accounts: [
        {
          phoneNumber: DEMO_PHONE,
          account: {
            name: "Demo Owner",
            plan: "free",
            recoveryKit: true,
            items: 0,
            contactsAccepted: 2,
            lifeCheck: { frequency: "quarterly", travelMode: true },
            deletionScheduled: false,
          },
        },
        { phoneNumber: SIGNUP_PHONE, account: null },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("482913");
  });

  it("flags a missing or malformed code", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    expect((await t.query(internal.store_review.status, {})).code).toBe(
      "missing",
    );
    process.env.REVIEW_CODE = "1234";
    expect((await t.query(internal.store_review.status, {})).code).toBe(
      "invalid",
    );
  });
});

describe("store review reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.REVIEW_PHONES;
  });

  it("refuses a number outside REVIEW_PHONES and leaves the account alone", async () => {
    process.env.REVIEW_PHONES = SIGNUP_PHONE;
    const t = makeT();
    const userId = await seedPhoneUser(t, REAL_PHONE);

    await expect(
      t.mutation(internal.store_review.reset, { phoneNumber: REAL_PHONE }),
    ).rejects.toThrow("Not a review number");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(userId))).not.toBeNull();
  });

  it("erases a listed account now so its number can sign up again", async () => {
    process.env.REVIEW_PHONES = `${DEMO_PHONE},${SIGNUP_PHONE}`;
    const t = makeT();
    const userId = await seedPhoneUser(t, SIGNUP_PHONE);

    await expect(
      t.mutation(internal.store_review.reset, { phoneNumber: SIGNUP_PHONE }),
    ).resolves.toEqual({ reset: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const left = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      audit: await ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    }));
    expect(left.user).toBeNull();
    expect(left.audit.map((log) => log.action)).toContain(
      "review_account_reset",
    );
  });

  it("does nothing for a listed number with no account", async () => {
    process.env.REVIEW_PHONES = SIGNUP_PHONE;
    const t = makeT();
    await expect(
      t.mutation(internal.store_review.reset, { phoneNumber: SIGNUP_PHONE }),
    ).resolves.toEqual({ reset: false });
  });
});
