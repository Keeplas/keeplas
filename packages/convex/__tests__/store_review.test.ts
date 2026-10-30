import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  makeT,
  runDueJobs,
  seedTrustContact,
  seedUser,
  type TestConvex,
} from "./test.helpers";

const DEMO_PHONE = "+12025550101";
const SIGNUP_PHONE = "+12025550104";
const REAL_PHONE = "+33612345678";
const DAY_MS = 86_400_000;

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
      cloudBackupOffAt: now,
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

/**
 * What a lapsed Life check and reviewers trying succession and recovery
 * leave on the demo owner: travel mode off, contacts asked to confirm, the
 * vault released once, a recovery request and an email.
 */
async function seedSuccessionLeftovers(t: TestConvex, userId: Id<"users">) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    await ctx.db.patch(config!._id, { travelModeEnabled: false });
    const cycleId = await ctx.db.insert("life_check_cycles", {
      userId,
      configId: config!._id,
      status: "awaiting_confirmation",
      channelsAttempted: [],
      scheduledAt: now,
      startedAt: now,
    });
    const [contact] = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const access = (status: "pending" | "approved") =>
      ctx.db.insert("access_requests", {
        vaultUserId: userId,
        requestedBy: contact._id,
        sectionsRequested: ["all"],
        status,
        autoResponseAt: now,
        createdAt: now,
        updatedAt: now,
      });
    const pendingAccessId = await access("pending");
    await access("approved");
    const recoveryId = await ctx.db.insert("recovery_requests", {
      userId,
      generation: 1,
      newDevicePublicKey: "pk",
      status: "approved_1",
      windowEndsAt: now + 3 * DAY_MS,
      expiresAt: now + 7 * DAY_MS,
      createdAt: now,
    });
    await ctx.db.patch(userId, {
      email: "reviewer@example.com",
      emailVerificationTime: now,
    });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "email-otp",
      providerAccountId: "reviewer@example.com",
      emailVerified: "reviewer@example.com",
    });
    return { cycleId, pendingAccessId, recoveryId };
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
            email: null,
            kitVerifier: { phraseSalt: "salt", recoveryPhraseHash: "verifier" },
            items: 0,
            contacts: 2,
            contactsAccepted: 2,
            lifeCheck: {
              frequency: "quarterly",
              travelMode: true,
              travelModeUntil: null,
              canStartSoon: false,
              cycle: null,
            },
            accessRequests: { pending: 0, approved: 0 },
            recoveryRequest: null,
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

  it("reports the succession and recovery state of a demo account", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    await seedSuccessionLeftovers(t, userId);
    await t.run(async (ctx) => {
      const now = Date.now();
      const vaultId = await ctx.db.insert("vaults", {
        userId,
        encryptedItemsCount: 0,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const item = (status: "active" | "archived") =>
        ctx.db.insert("vault_items", {
          vaultId,
          userId,
          encryptedContent: "sealed-content",
          encryptionType: "zero_knowledge",
          sharedWithContacts: [],
          accessLevel: "private",
          status,
          createdAt: now,
          updatedAt: now,
        });
      await item("active");
      await item("archived"); // Deleted in the app: neither shown nor counted.
      const [contact] = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      await ctx.db.patch(contact._id, { invitationStatus: "revoked" });
    });

    const [{ account }] = (await t.query(internal.store_review.status, {}))
      .accounts;

    expect(account).toMatchObject({
      email: "reviewer@example.com",
      items: 1,
      contacts: 1,
      contactsAccepted: 1,
      lifeCheck: {
        travelMode: false,
        canStartSoon: true,
        cycle: "awaiting_confirmation",
      },
      accessRequests: { pending: 1, approved: 1 },
      recoveryRequest: "approved_1",
    });
  });

  it("flags travel mode that ends within 14 days, not later", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    const travelUntil = (until: number) =>
      t.run(async (ctx) => {
        const config = await ctx.db
          .query("life_check_configs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first();
        await ctx.db.patch(config!._id, { travelModeUntil: until });
      });
    const lifeCheck = async () =>
      (await t.query(internal.store_review.status, {})).accounts[0].account
        ?.lifeCheck;

    await travelUntil(Date.now() + 13 * DAY_MS);
    expect(await lifeCheck()).toMatchObject({ canStartSoon: true });
    await travelUntil(Date.now() + 20 * DAY_MS);
    expect(await lifeCheck()).toMatchObject({ canStartSoon: false });
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
      lifeCheckPaused: false,
      recoveryCancelled: false,
      emailRemoved: false,
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

  it("pauses the Life check for 180 days, ends requests and removes the email", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    const { cycleId, pendingAccessId, recoveryId } =
      await seedSuccessionLeftovers(t, userId);

    await expect(
      t.mutation(internal.store_review.clearDrift, { phoneNumber: DEMO_PHONE }),
    ).resolves.toMatchObject({
      lifeCheckPaused: true,
      recoveryCancelled: true,
      emailRemoved: true,
    });

    const after = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      config: await ctx.db
        .query("life_check_configs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      cycle: await ctx.db.get(cycleId),
      access: await ctx.db.get(pendingAccessId),
      released: await ctx.db
        .query("access_requests")
        .withIndex("by_status", (q) =>
          q.eq("vaultUserId", userId).eq("status", "approved"),
        )
        .collect(),
      recovery: await ctx.db.get(recoveryId),
      emailAccounts: await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "email-otp"),
        )
        .collect(),
    }));
    expect(after.config?.travelModeEnabled).toBe(true);
    expect(after.config?.travelModeUntil).toBeGreaterThan(
      Date.now() + 179 * DAY_MS,
    );
    expect(after.cycle?.status).toBe("cancelled");
    expect(after.access?.status).toBe("denied");
    // A released vault needs a re-seed: clearing never hides it.
    expect(after.released).toHaveLength(1);
    expect(after.recovery?.status).toBe("cancelled");
    expect(after.user?.email).toBeUndefined();
    expect(after.user?.emailVerificationTime).toBeUndefined();
    expect(after.emailAccounts).toHaveLength(0);

    const [{ account }] = (await t.query(internal.store_review.status, {}))
      .accounts;
    expect(account).toMatchObject({
      email: null,
      lifeCheck: { canStartSoon: false, cycle: null },
      accessRequests: { pending: 0, approved: 1 },
      recoveryRequest: null,
    });
  });

  it("turns off a cloud backup that was never turned off", async () => {
    // A contact seeded before the seed turned it off: no backup yet, but the
    // next reviewer's phone would make one (mobile lib/backup-policy.ts).
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);
    await t.run((ctx) => ctx.db.patch(userId, { cloudBackupOffAt: undefined }));
    const account = async () =>
      (await t.query(internal.store_review.status, {})).accounts[0].account;

    expect(await account()).toMatchObject({ cloudBackup: true });
    await expect(
      t.mutation(internal.store_review.clearDrift, { phoneNumber: DEMO_PHONE }),
    ).resolves.toMatchObject({ backupTurnedOff: true });
    expect(await account()).toMatchObject({ cloudBackup: false });
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
      lifeCheckPaused: false,
      recoveryCancelled: false,
      emailRemoved: false,
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

describe("review accounts keep their number and email", () => {
  afterEach(() => {
    delete process.env.REVIEW_PHONES;
  });

  async function expectRefused(call: Promise<unknown>) {
    const error = await call.then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<string>).data).toContain(
      "Review accounts can't change their number or email",
    );
  }

  it("refuses a new number and sends no code", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);

    await expectRefused(
      asUser(t, userId).mutation(api.phone_verification.requestVerification, {
        phoneNumber: REAL_PHONE,
      }),
    );
    const codes = await t.run((ctx) =>
      ctx.db.query("phone_verification_codes").collect(),
    );
    expect(codes).toHaveLength(0);
  });

  it("refuses an email and sends no code", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedDemoOwner(t);

    await expectRefused(
      asUser(t, userId).mutation(api.email_verification.requestVerification, {
        email: "reviewer@example.com",
      }),
    );
    const codes = await t.run((ctx) =>
      ctx.db.query("email_verification_codes").collect(),
    );
    expect(codes).toHaveLength(0);
  });

  it("still lets other accounts add an email", async () => {
    process.env.REVIEW_PHONES = DEMO_PHONE;
    const t = makeT();
    const userId = await seedPhoneUser(t, REAL_PHONE);

    await expect(
      asUser(t, userId).mutation(api.email_verification.requestVerification, {
        email: "someone@example.com",
      }),
    ).resolves.toEqual({ sent: true });
  });
});
