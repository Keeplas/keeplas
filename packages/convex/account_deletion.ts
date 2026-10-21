import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auditedMutation, createAuditLog } from "./audit";
import { activePushTokens } from "./devices";
import { optionalAuth, requireFullAuth } from "./helpers";
import { deleteBlob } from "./lib/storage";

export const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 200;

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user?.deletionScheduledAt
      ? { scheduledAt: user.deletionScheduledAt }
      : null;
  },
});

export const request = auditedMutation({
  action: "user.account.deletion_requested",
  resourceType: "user",
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmation !== "DELETE") {
      throw new Error("Confirmation phrase mismatch");
    }
    const userId = await requireFullAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.deletionScheduledAt) {
      return { scheduledAt: user.deletionScheduledAt };
    }
    const scheduledAt = Date.now() + DELETION_GRACE_MS;
    const deletionJobId = await ctx.scheduler.runAt(
      scheduledAt,
      internal.account_deletion.execute,
      { userId },
    );
    await ctx.db.patch(userId, {
      deletionScheduledAt: scheduledAt,
      deletionJobId,
    });
    await ctx.scheduler.runAfter(0, internal.dispatch.notifyDeletionScheduled, {
      email: user.email,
      phoneNumber: user.phoneNumber,
      ownerName: user.name,
      language: user.language,
      pushTokens: await activePushTokens(ctx, userId),
      date: new Date(scheduledAt).toISOString().slice(0, 10),
    });
    return { scheduledAt };
  },
});

export const cancel = auditedMutation({
  action: "user.account.deletion_cancelled",
  resourceType: "user",
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.deletionScheduledAt) return { cancelled: false };
    if (user.deletionJobId) await ctx.scheduler.cancel(user.deletionJobId);
    await ctx.db.patch(userId, {
      deletionScheduledAt: undefined,
      deletionJobId: undefined,
    });
    return { cancelled: true };
  },
});

export const execute = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user?.deletionScheduledAt || user.deletionScheduledAt > Date.now()) {
      return;
    }
    await createAuditLog(ctx, {
      userId,
      actorType: "system",
      actorId: "account_deletion",
      action: "account_wipe_executed",
      resourceType: "user",
      resourceId: userId,
    });
    await ctx.scheduler.runAfter(0, internal.account_deletion.wipeStep, {
      userId,
    });
  },
});

export const wipeStep = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    let budget = BATCH;
    for (const step of STEPS) {
      while (budget > 0) {
        const done = await step(ctx, userId, budget);
        budget -= done;
        if (done === 0) break;
      }
      if (budget <= 0) {
        await ctx.scheduler.runAfter(0, internal.account_deletion.wipeStep, {
          userId,
        });
        return;
      }
    }
    const user = await ctx.db.get(userId);
    if (user?.avatarStorageId) await deleteBlob(ctx, user.avatarStorageId);
    if (user) await ctx.db.delete(userId);
  },
});

type Step = (
  ctx: MutationCtx,
  userId: Id<"users">,
  limit: number,
) => Promise<number>;

async function dropContactLinks(
  ctx: MutationCtx,
  contactId: Id<"trusted_contacts">,
): Promise<number> {
  let deleted = 0;
  for (const key of await ctx.db
    .query("vault_item_recipient_keys")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect()) {
    await ctx.db.delete(key._id);
    deleted += 1;
  }
  for (const share of await ctx.db
    .query("recovery_secret_shares")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect()) {
    await ctx.db.patch(share.userId, { socialRecoveryRenewalRequired: true });
    await ctx.db.delete(share._id);
    deleted += 1;
  }
  for (const grant of await ctx.db
    .query("folder_grants")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect()) {
    await ctx.db.delete(grant._id);
    deleted += 1;
  }
  for (const request of await ctx.db
    .query("access_requests")
    .withIndex("by_requester", (q) => q.eq("requestedBy", contactId))
    .collect()) {
    await ctx.db.delete(request._id);
    deleted += 1;
  }
  return deleted;
}

const SIMPLE_TABLES = [
  "phone_verification_codes",
  "email_verification_codes",
  "passkey_credentials",
  "social_envelopes",
  "cloud_backup_envelopes",
  "devices",
  "totp_secrets",
  "auth_session_totp",
  "login_otp_codes",
  "auth_session_login_otp",
  "recipient_groups",
  "life_check_cycles",
  "life_check_configs",
  "notifications",
  "analytics_events",
  "support_tickets",
  "vaults",
] as const;

const STEPS: Step[] = [
  async (ctx, userId, limit) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const session of sessions) {
      for (const token of await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect()) {
        await ctx.db.delete(token._id);
        deleted += 1;
      }
      await ctx.db.delete(session._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const account of accounts) {
      for (const code of await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect()) {
        await ctx.db.delete(code._id);
        deleted += 1;
      }
      await ctx.db.delete(account._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const asContact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", userId))
      .take(limit);
    let deleted = 0;
    for (const contact of asContact) {
      deleted += await dropContactLinks(ctx, contact._id);
      await ctx.db.patch(contact._id, {
        invitationStatus: "revoked",
        contactUserId: undefined,
        contactPublicKey: undefined,
        contactIdentityPublicKey: undefined,
        contactPublicKeySignature: undefined,
        updatedAt: Date.now(),
      });
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const item of items) {
      for (const key of await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect()) {
        await ctx.db.delete(key._id);
        deleted += 1;
      }
      for (const file of await ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect()) {
        await deleteBlob(ctx, file.storageId);
        await ctx.db.delete(file._id);
        deleted += 1;
      }
      await ctx.db.delete(item._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const files = await ctx.db
      .query("vault_item_files")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
    for (const file of files) {
      await deleteBlob(ctx, file.storageId);
      await ctx.db.delete(file._id);
    }
    return files.length;
  },
  async (ctx, userId, limit) => {
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const folder of folders) {
      for (const grant of await ctx.db
        .query("folder_grants")
        .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
        .collect()) {
        await ctx.db.delete(grant._id);
        deleted += 1;
      }
      await ctx.db.delete(folder._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const contact of contacts) {
      deleted += await dropContactLinks(ctx, contact._id);
      await ctx.db.delete(contact._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const requests = await ctx.db
      .query("recovery_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
    let deleted = 0;
    for (const request of requests) {
      for (const approval of await ctx.db
        .query("recovery_approvals")
        .withIndex("by_request", (q) => q.eq("requestId", request._id))
        .collect()) {
        await ctx.db.delete(approval._id);
        deleted += 1;
      }
      await ctx.db.delete(request._id);
      deleted += 1;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    let deleted = 0;
    for (const table of SIMPLE_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(limit - deleted);
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
      if (deleted >= limit) break;
    }
    return deleted;
  },
  async (ctx, userId, limit) => {
    const shares = await ctx.db
      .query("recovery_secret_shares")
      .withIndex("by_user_generation", (q) => q.eq("userId", userId))
      .take(limit);
    for (const share of shares) await ctx.db.delete(share._id);
    const gates = await ctx.db
      .query("gate_keys")
      .withIndex("by_user_generation", (q) => q.eq("userId", userId))
      .take(limit - shares.length);
    for (const gate of gates) await ctx.db.delete(gate._id);
    return shares.length + gates.length;
  },
  async (ctx, userId, limit) => {
    const requests = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", userId))
      .take(limit);
    for (const request of requests) await ctx.db.delete(request._id);
    return requests.length;
  },
  async (ctx, userId, limit) => {
    const user = await ctx.db.get(userId);
    const phoneCodes = user?.phoneNumber
      ? await ctx.db
          .query("phone_auth_codes")
          .withIndex("by_phone", (q) => q.eq("phoneNumber", user.phoneNumber!))
          .take(limit)
      : [];
    for (const code of phoneCodes) await ctx.db.delete(code._id);
    const emailCodes = user?.email
      ? await ctx.db
          .query("email_auth_codes")
          .withIndex("by_email", (q) => q.eq("email", user.email!))
          .take(limit - phoneCodes.length)
      : [];
    for (const code of emailCodes) await ctx.db.delete(code._id);
    return phoneCodes.length + emailCodes.length;
  },
];
