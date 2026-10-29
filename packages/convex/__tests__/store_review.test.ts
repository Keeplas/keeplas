import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  runDueJobs,
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
      language: "en-US",
      phraseSalt: "salt",
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

/**
 * What reviewers can leave behind: the first phone (confirmed), two more
 * waiting for "It was me", one revoked, plus cloud backup on, French, a
 * Lifetime purchase, a deletion request and an "It wasn't me" rotation.
 */
async function seedReviewerLeftovers(t: TestConvex, userId: Id<"users">) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const device = (fields: { acknowledgedAt?: number; revokedAt?: number }) =>
      ctx.db.insert("devices", {
        userId,
        kind: "ios",
        label: "iPhone",
        trusted: false,
        lastSeenAt: now,
        createdAt: now,
        ...fields,
      });
    await device({ acknowledgedAt: now });
    await device({});
    await device({});
    await device({ revokedAt: now });
    await ctx.db.insert("cloud_backup_envelopes", {
      userId,
      provider: "icloud",
      envelope: "sealed",
      phraseSalt: "salt",
      createdAt: now,
    });
    await ctx.db.patch(userId, {
      language: "fr-FR",
      plan: "lifetime",
      deletionScheduledAt: now,
      masterKeyRotationRequired: true,
      cloudBackupOffAt: undefined,
    });
  });
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
            kitVerifier: { phraseSalt: "salt", recoveryPhraseHash: "verifier" },
            items: 0,
            contactsAccepted: 2,
            lifeCheck: { frequency: "quarterly", travelMode: true },
            deletionScheduled: false,
            devicesPending: 0,
            masterKeyRotationRequired: false,
            cloudBackup: false,
            language: "en-US",
          },
        },
        { phoneNumber: SIGNUP_PHONE, account: null },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("482913");
  });

  it("reports what earlier reviewers left on a demo account", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    await seedReviewerLeftovers(t, userId);

    const [{ account }] = (await t.query(internal.store_review.status, {}))
      .accounts;

    expect(account).toMatchObject({
      plan: "lifetime",
      devicesPending: 2,
      masterKeyRotationRequired: true,
      cloudBackup: true,
      language: "fr-FR",
      deletionScheduled: true,
    });
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
    await runDueJobs(t);

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

describe("store review drift clearing", () => {
  afterEach(() => {
    delete process.env.REVIEW_PHONES;
  });

  it("refuses a number outside REVIEW_PHONES and leaves the account alone", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedPhoneUser(t, REAL_PHONE);
    await seedReviewerLeftovers(t, userId);

    await expect(
      t.mutation(internal.store_review.clearDrift, { phoneNumber: REAL_PHONE }),
    ).rejects.toThrow("Not a review number");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.language).toBe("fr-FR");
  });

  it("confirms waiting devices, turns the backup off and resets the language", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    await seedReviewerLeftovers(t, userId);

    await expect(
      t.mutation(internal.store_review.clearDrift, { phoneNumber: DEMO_PHONE }),
    ).resolves.toEqual({
      devicesConfirmed: 2,
      backupTurnedOff: true,
      languageReset: true,
    });

    const after = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      devices: await ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      backups: await ctx.db
        .query("cloud_backup_envelopes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      audit: await ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    }));
    // Every device is settled, and the revoked one stays revoked.
    expect(
      after.devices.filter(
        (d) => d.acknowledgedAt === undefined && d.revokedAt === undefined,
      ),
    ).toHaveLength(0);
    expect(after.devices.filter((d) => d.revokedAt !== undefined)).toHaveLength(
      1,
    );
    expect(after.backups).toHaveLength(0);
    expect(after.user?.cloudBackupOffAt).toBeDefined();
    expect(after.user?.language).toBe("en-US");
    // Only a re-seed undoes these: clearing never hides them.
    expect(after.user).toMatchObject({
      plan: "lifetime",
      masterKeyRotationRequired: true,
    });
    expect(after.user?.deletionScheduledAt).toBeDefined();
    expect(after.audit.map((log) => log.action)).toContain(
      "review_account_cleared",
    );
  });

  it("changes nothing on a clean demo account", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    await seedDemoOwner(t);

    await expect(
      t.mutation(internal.store_review.clearDrift, { phoneNumber: DEMO_PHONE }),
    ).resolves.toEqual({
      devicesConfirmed: 0,
      backupTurnedOff: false,
      languageReset: false,
    });
  });

  it("does nothing for a listed number with no account", async () => {
    process.env.REVIEW_PHONES = SIGNUP_PHONE;
    const t = makeT();
    await expect(
      t.mutation(internal.store_review.clearDrift, {
        phoneNumber: SIGNUP_PHONE,
      }),
    ).resolves.toBeNull();
  });
});
