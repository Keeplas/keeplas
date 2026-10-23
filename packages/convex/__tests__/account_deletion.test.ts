import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DELETION_GRACE_MS } from "../account_deletion";
import { getBlobDownloadUrl } from "../lib/storage";
import {
  asUser,
  makeT,
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
      stripeSessionId: "cs_test",
      amountCents: 19900,
      currency: "usd",
      status: "paid",
      plan: "lifetime",
      createdAt: now,
    });
    return { vaultId, folderId, itemId };
  });
  return { userId, storageId, contactId, ...ids };
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
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const left = await t.run(async (ctx) => ({
      user: await ctx.db.get(owner.userId),
      item: await ctx.db.get(owner.itemId),
      folder: await ctx.db.get(owner.folderId),
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
    }));

    expect(left.user).toBeNull();
    expect(left.item).toBeNull();
    expect(left.folder).toBeNull();
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
  });
});
