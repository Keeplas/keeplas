import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DELETION_GRACE_MS } from "../account_deletion";
import { getBlobDownloadUrl } from "../lib/storage";
import {
  asUser,
  makeT,
  runDueJobs,
  seedSession,
  seedStorageRef,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

async function seedVaultOwner(t: TestConvex) {
  const userId = await seedUser(t);
  await seedSession(t, userId);
  const storageId = await seedStorageRef(t, 64);
  const contactId = await seedTrustContact(t, userId, { n: 1 });
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const vaultId = await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 1,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const folderId = await ctx.db.insert("folders", {
      userId,
      encryptedName: SEALED,
      createdAt: now,
      updatedAt: now,
    });
    const categoryId = await ctx.db.insert("vault_categories", {
      userId,
      encryptedName: SEALED,
      createdAt: now,
    });
    const itemId = await ctx.db.insert("vault_items", {
      vaultId,
      userId,
      folderId,
      encryptedMeta: SEALED,
      encryptedContent: SEALED,
      encryptionType: "zero_knowledge",
      sharedWithContacts: [contactId],
      accessLevel: "trusted_only",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("vault_item_files", {
      itemId,
      userId,
      storageId,
      iv: "aXY=",
      encryptedMeta: SEALED,
      sizeBucket: 4096,
      order: 0,
      createdAt: now,
    });
    await ctx.db.insert("vault_item_recipient_keys", {
      itemId,
      contactId,
      wrappedDek: "wrapped",
      createdAt: now,
    });
    await ctx.db.insert("payments", {
      userId,
      revenueCatTransactionId: "rc_test",
      amountCents: 9900,
      currency: "usd",
      status: "paid",
      plan: "lifetime",
      createdAt: now,
    });
    return { vaultId, folderId, categoryId, itemId };
  });
  return { userId, storageId, contactId, ...ids };
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The privacy policy promises this figure: keep it a literal, not the constant.
const SECURITY_LOG_RETENTION_MS = 30 * DAY_MS;

function securityLog(t: TestConvex, userId: Id<"users">) {
  return t.run((ctx) =>
    ctx.db
      .query("audit_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

async function pendingPurges(t: TestConvex) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter(
      (job) =>
        job.name === "account_deletion:purgeSecurityLog" &&
        job.state.kind === "pending",
    )
    .map(({ args, scheduledTime }) => ({ args, scheduledTime }));
}

async function seedLogs(
  t: TestConvex,
  userId: Id<"users">,
  count: number,
  action = "user.profile.updated",
  createdAt = Date.now(),
) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("audit_logs", {
        userId,
        actorType: "user",
        actorId: userId,
        action,
        resourceType: "user",
        resourceId: userId,
        ipAddress: "127.0.0.1",
        country: "FR",
        previousLogHash: "genesis",
        logHash: `hash-${i}`,
        createdAt,
      });
    }
  });
}

async function requestDeletion(t: TestConvex, userId: Id<"users">) {
  return asUser(t, userId).mutation(api.account_deletion.request, {
    confirmation: "DELETE",
    _audit: await signedAudit(),
  });
}

describe("account deletion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs the confirmation word", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await expect(
      asUser(t, userId).mutation(api.account_deletion.request, {
        confirmation: "delete",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Confirmation phrase mismatch");
  });

  it("schedules the deletion 7 days out, and can be cancelled", async () => {
    const t = makeT();
    const { userId } = await seedVaultOwner(t);
    const { scheduledAt } = await requestDeletion(t, userId);
    expect(scheduledAt - Date.now()).toBe(DELETION_GRACE_MS);
    expect(
      await asUser(t, userId).query(api.account_deletion.getStatus, {}),
    ).toEqual({ scheduledAt });

    await asUser(t, userId).mutation(api.account_deletion.cancel, {
      _audit: await signedAudit(),
    });
    vi.advanceTimersByTime(DELETION_GRACE_MS + 1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get(userId))).not.toBeNull();
    expect(
      await asUser(t, userId).query(api.account_deletion.getStatus, {}),
    ).toBeNull();
  });

  it("erases everything after the grace period and keeps legal records", async () => {
    const t = makeT();
    const owner = await seedVaultOwner(t);
    const versionBlob = await seedStorageRef(t, 32);
    const sessionId = await seedSession(t, owner.userId);
    await t.run(async (ctx) => {
      await ctx.db.patch(owner.userId, {
        phoneNumber: "+33600000009",
        email: "owner@example.com",
      });
      await ctx.db.insert("number_change_requests", {
        userId: owner.userId,
        oldPhone: "+33600000009",
        newPhone: "+33600000010",
        declaredName: "Owner",
        status: "completed",
        claimHash: "hash",
        createdAt: 0,
        windowEndsAt: 0,
      });
      await ctx.db.insert("session_phone_codes", {
        userId: owner.userId,
        sessionId,
        phoneNumber: "+33600000009",
        codeHash: "hash",
        expiresAt: 0,
        attempts: 0,
      });
      await ctx.db.insert("device_pins", {
        userId: owner.userId,
        sessionId,
        proofHash: "hash",
        secret: "secret",
        failCount: 0,
        createdAt: 0,
      });
      await ctx.db.insert("capture_handoffs", {
        userId: owner.userId,
        status: "completed",
        expiresAt: 0,
        createdAt: 0,
      });
      await ctx.db.insert("phone_auth_codes", {
        phoneNumber: "+33600000009",
        codeHash: "hash",
        expiresAt: 0,
        attempts: 0,
        intent: "signin",
      });
      await ctx.db.insert("vault_item_versions", {
        itemId: owner.itemId,
        userId: owner.userId,
        encryptedContent: SEALED,
        files: [{ storageId: versionBlob, iv: "aXY=", order: 0 }],
        savedAt: 0,
        replacedAt: 0,
      });
      await ctx.db.insert("email_auth_codes", {
        email: "owner@example.com",
        codeHash: "hash",
        expiresAt: 0,
        attempts: 0,
        intent: "signin",
      });
    });
    const other = await seedUser(t);
    const otherContact = await seedTrustContact(t, other, { n: 2 });
    await t.run(async (ctx) => {
      await ctx.db.patch(otherContact, { contactUserId: owner.userId });
      await ctx.db.insert("recovery_secret_shares", {
        userId: other,
        contactId: otherContact,
        generation: 1,
        wrappedShare: "share",
      });
    });

    await requestDeletion(t, owner.userId);
    vi.advanceTimersByTime(DELETION_GRACE_MS - 60_000);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.get(owner.userId))).not.toBeNull();

    vi.advanceTimersByTime(120_000);
    await runDueJobs(t);

    const left = await t.run(async (ctx) => ({
      user: await ctx.db.get(owner.userId),
      item: await ctx.db.get(owner.itemId),
      folder: await ctx.db.get(owner.folderId),
      category: await ctx.db.get(owner.categoryId),
      vault: await ctx.db.get(owner.vaultId),
      contact: await ctx.db.get(owner.contactId),
      files: await ctx.db
        .query("vault_item_files")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      keys: await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", owner.itemId))
        .collect(),
      sessions: await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", owner.userId))
        .collect(),
      blob: await getBlobDownloadUrl(ctx, owner.storageId),
      payments: await ctx.db
        .query("payments")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      audit: await ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      otherContact: await ctx.db.get(otherContact),
      otherShares: await ctx.db
        .query("recovery_secret_shares")
        .withIndex("by_contact", (q) => q.eq("contactId", otherContact))
        .collect(),
      otherUser: await ctx.db.get(other),
      versions: await ctx.db
        .query("vault_item_versions")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      versionBlob: await getBlobDownloadUrl(ctx, versionBlob),
      phoneCodes: await ctx.db
        .query("phone_auth_codes")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", "+33600000009"))
        .collect(),
      emailCodes: await ctx.db
        .query("email_auth_codes")
        .withIndex("by_email", (q) => q.eq("email", "owner@example.com"))
        .collect(),
      numberChanges: await ctx.db
        .query("number_change_requests")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      sessionPhoneCodes: await ctx.db
        .query("session_phone_codes")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      captureHandoffs: await ctx.db
        .query("capture_handoffs")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
      devicePins: await ctx.db
        .query("device_pins")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .collect(),
    }));

    expect(left.user).toBeNull();
    expect(left.item).toBeNull();
    expect(left.folder).toBeNull();
    expect(left.category).toBeNull();
    expect(left.vault).toBeNull();
    expect(left.contact).toBeNull();
    expect(left.files).toEqual([]);
    expect(left.keys).toEqual([]);
    expect(left.sessions).toEqual([]);
    expect(left.blob).toBeNull();
    expect(left.payments).toHaveLength(1);
    expect(left.audit.map((log) => log.action)).toContain(
      "account_wipe_executed",
    );
    expect(left.otherContact?.invitationStatus).toBe("revoked");
    expect(left.otherContact?.contactUserId).toBeUndefined();
    expect(left.otherShares).toEqual([]);
    expect(left.otherUser?.socialRecoveryRenewalRequired).toBe(true);
    expect(left.versions).toEqual([]);
    expect(left.versionBlob).toBeNull();
    expect(left.phoneCodes).toEqual([]);
    expect(left.emailCodes).toEqual([]);
    expect(left.numberChanges).toEqual([]);
    expect(left.sessionPhoneCodes).toEqual([]);
    expect(left.captureHandoffs).toEqual([]);
    expect(left.devicePins).toEqual([]);
  });

  it("deletes the security log 30 days after the erasure, and only the erased account's", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const other = await seedUser(t);
    // More entries than one purge batch, so the purge has to continue itself.
    await seedLogs(t, owner, 450);

    await requestDeletion(t, owner);
    await requestDeletion(t, other);
    await asUser(t, other).mutation(api.account_deletion.cancel, {
      _audit: await signedAudit(),
    });

    vi.advanceTimersByTime(DELETION_GRACE_MS);
    await runDueJobs(t);
    const erasedAt = Date.now();
    expect(await t.run((ctx) => ctx.db.get(owner))).toBeNull();
    expect((await securityLog(t, owner)).map((log) => log.action)).toContain(
      "account_wipe_executed",
    );

    // convex-test runs jobs on setTimeout, which fires any delay over ~24.8
    // days after 1 ms; so check the job the scheduler holds, then run it.
    const purges = await pendingPurges(t);
    expect(purges).toEqual([
      {
        args: [{ userId: owner }],
        scheduledTime: erasedAt + SECURITY_LOG_RETENTION_MS,
      },
    ]);
    expect(await securityLog(t, owner)).toHaveLength(450 + 2);

    await t.mutation(internal.account_deletion.purgeSecurityLog, {
      userId: owner,
    });
    await runDueJobs(t);
    expect(await securityLog(t, owner)).toEqual([]);
    expect((await securityLog(t, other)).map((log) => log.action)).toEqual([
      "user.account.deletion_requested",
      "user.account.deletion_cancelled",
    ]);
    expect(await t.run((ctx) => ctx.db.get(other))).not.toBeNull();
  });

  it("never purges the security log of a living account", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedLogs(t, userId, 3);
    await t.mutation(internal.account_deletion.purgeSecurityLog, { userId });
    expect(await securityLog(t, userId)).toHaveLength(3);
  });
});

describe("security log of accounts erased before the purge existed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is deleted 30 days after each account's erasure", async () => {
    const t = makeT();
    const living = await seedUser(t);
    const erasedLongAgo = await seedUser(t);
    const erasedRecently = await seedUser(t);
    await seedLogs(t, living, 2);
    await seedLogs(t, erasedLongAgo, 3, "user.profile.updated", 0);
    await seedLogs(
      t,
      erasedLongAgo,
      1,
      "account_wipe_executed",
      Date.now() - 40 * DAY_MS,
    );
    await seedLogs(
      t,
      erasedRecently,
      1,
      "account_wipe_executed",
      Date.now() - 10 * DAY_MS,
    );
    await t.run(async (ctx) => {
      await ctx.db.delete(erasedLongAgo);
      await ctx.db.delete(erasedRecently);
    });

    await t.mutation(internal.migrations.purgeErasedAccountsSecurityLogs, {});
    await runDueJobs(t);
    expect(await securityLog(t, erasedLongAgo)).toEqual([]);
    expect(await securityLog(t, erasedRecently)).toHaveLength(1);
    expect(await securityLog(t, living)).toHaveLength(2);

    vi.advanceTimersByTime(20 * DAY_MS + 60_000);
    await runDueJobs(t);
    expect(await securityLog(t, erasedRecently)).toEqual([]);
    expect(await securityLog(t, living)).toHaveLength(2);
  });
});

describe("deletion requested outside the app", () => {
  const PHONE = "+33612345678";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules the same 7-day deletion for the number on file, once", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(userId, { phoneNumber: PHONE }));

    const first = await t.mutation(internal.account_deletion.scheduleForPhone, {
      phoneNumber: PHONE,
    });
    expect(first.alreadyScheduled).toBe(false);
    expect(first.scheduledAt - Date.now()).toBe(DELETION_GRACE_MS);
    expect(
      await asUser(t, userId).query(api.account_deletion.getStatus, {}),
    ).toEqual({ scheduledAt: first.scheduledAt });

    const again = await t.mutation(internal.account_deletion.scheduleForPhone, {
      phoneNumber: PHONE,
    });
    expect(again).toEqual({
      scheduledAt: first.scheduledAt,
      alreadyScheduled: true,
    });
    const requests = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("audit_logs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      ).filter((log) => log.action === "user.account.deletion_requested"),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.actorId).toBe("support");
  });

  it("refuses a number with no account", async () => {
    const t = makeT();
    await expect(
      t.mutation(internal.account_deletion.scheduleForPhone, {
        phoneNumber: PHONE,
      }),
    ).rejects.toThrow("No account for this phone number");
  });
});
