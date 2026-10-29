import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAuditLog } from "./audit";
import { getUserByPhone } from "./helpers";
import { listedPhones, normalizeE164 } from "./lib/phone";

/**
 * App Store / Google Play review accounts. The numbers in REVIEW_PHONES accept
 * the secret REVIEW_CODE instead of a WhatsApp code (phone_auth.ts), so
 * reviewers can sign in to a seeded demo account and try sign-up on a spare
 * number. These internal functions back `pnpm review:status`,
 * `pnpm review:clear` and `pnpm review:reset` (scripts/review-accounts.mjs);
 * clients never reach them. Runbook: apps/mobile/APP_REVIEW.md.
 */

// A handful of numbers is plenty; the bound keeps the status reads small.
const MAX_REVIEW_PHONES = 10;
const MAX_COUNTED_ITEMS = 50;
// What the app saves for English (accountLanguageTag in the mobile i18n).
const REVIEW_LANGUAGE = "en-US";

/** The E.164 number if REVIEW_PHONES lists it: real accounts are off-limits. */
function requireReviewPhone(phoneNumber: string): string {
  const phone = normalizeE164(phoneNumber);
  if (!phone || !listedPhones(process.env.REVIEW_PHONES).includes(phone)) {
    throw new ConvexError(
      "Not a review number: only accounts listed in REVIEW_PHONES can be changed here",
    );
  }
  return phone;
}

/**
 * Whether each review number is ready for a submission, including what an
 * earlier reviewer may have left on it (devices waiting for "It was me", a
 * pending key rotation, the cloud backup turned on, another language). Reports
 * the code as "set", "missing" or "invalid", never its value. `kitVerifier`
 * lets the script check, without the words leaving the operator's machine,
 * that REVIEW_KIT still opens the account.
 */
export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const reviewCode = process.env.REVIEW_CODE;
    const code = !reviewCode
      ? ("missing" as const)
      : /^\d{6}$/.test(reviewCode)
        ? ("set" as const)
        : ("invalid" as const);

    const accounts = [];
    for (const phoneNumber of listedPhones(process.env.REVIEW_PHONES).slice(
      0,
      MAX_REVIEW_PHONES,
    )) {
      const user = await getUserByPhone(ctx, phoneNumber);
      if (!user) {
        accounts.push({ phoneNumber, account: null });
        continue;
      }
      const items = await ctx.db
        .query("vault_items")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(MAX_COUNTED_ITEMS);
      const contacts = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(MAX_COUNTED_ITEMS);
      const lifeCheck = await ctx.db
        .query("life_check_configs")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      // Every row: the newest ones are the reviewers' phones.
      const devices = await ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const backup = await ctx.db
        .query("cloud_backup_envelopes")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      accounts.push({
        phoneNumber,
        account: {
          name: user.name ?? null,
          plan: user.plan ?? "free",
          kitVerifier:
            user.phraseSalt && user.recoveryPhraseHash
              ? {
                  phraseSalt: user.phraseSalt,
                  recoveryPhraseHash: user.recoveryPhraseHash,
                }
              : null,
          items: items.length,
          contactsAccepted: contacts.filter(
            (contact) => contact.invitationStatus === "accepted",
          ).length,
          lifeCheck: lifeCheck
            ? {
                frequency: lifeCheck.frequency,
                travelMode: lifeCheck.travelModeEnabled,
              }
            : null,
          deletionScheduled: Boolean(user.deletionScheduledAt),
          devicesPending: devices.filter(isPendingDevice).length,
          masterKeyRotationRequired: Boolean(user.masterKeyRotationRequired),
          cloudBackup: backup !== null,
          language: user.language ?? null,
        },
      });
    }
    return { code, accounts };
  },
});

/** A device still raising "New device detected" (devices.pendingAlerts). */
function isPendingDevice(device: {
  acknowledgedAt?: number;
  revokedAt?: number;
}): boolean {
  return device.acknowledgedAt === undefined && device.revokedAt === undefined;
}

/**
 * Undo what a reviewer can leave on a demo account without harming it:
 * answer "It was me" for every waiting device, turn the cloud backup off (as
 * the seed does, so the next reviewer's phone goes straight to the recovery
 * kit) and set the language back to English. A new kit, a pending key
 * rotation, a purchase or a deletion request need a re-seed instead. Refuses
 * any number outside REVIEW_PHONES.
 */
export const clearDrift = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByPhone(
      ctx,
      requireReviewPhone(args.phoneNumber),
    );
    if (!user) return null;
    const now = Date.now();

    const pending = (
      await ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    ).filter(isPendingDevice);
    for (const device of pending) {
      await ctx.db.patch(device._id, { acknowledgedAt: now });
    }

    const backups = await ctx.db
      .query("cloud_backup_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const backup of backups) await ctx.db.delete(backup._id);

    const languageReset =
      user.language !== undefined && !user.language.startsWith("en");
    const result = {
      devicesConfirmed: pending.length,
      backupTurnedOff: backups.length > 0,
      languageReset,
    };
    if (backups.length > 0 || languageReset) {
      await ctx.db.patch(user._id, {
        ...(backups.length > 0 ? { cloudBackupOffAt: now } : {}),
        ...(languageReset ? { language: REVIEW_LANGUAGE } : {}),
        updatedAt: now,
      });
    }
    await createAuditLog(ctx, {
      userId: user._id,
      actorType: "system",
      actorId: "store_review",
      action: "review_account_cleared",
      resourceType: "user",
      resourceId: user._id,
      metadata: JSON.stringify(result),
    });
    return result;
  },
});

/**
 * Erase a review account now, so its number can be signed up again (the spare
 * number a reviewer used to try sign-up). Refuses any number outside
 * REVIEW_PHONES, so a real account can never be wiped this way.
 */
export const reset = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByPhone(
      ctx,
      requireReviewPhone(args.phoneNumber),
    );
    if (!user) return { reset: false };
    await createAuditLog(ctx, {
      userId: user._id,
      actorType: "system",
      actorId: "store_review",
      action: "review_account_reset",
      resourceType: "user",
      resourceId: user._id,
    });
    await ctx.scheduler.runAfter(0, internal.account_deletion.wipeStep, {
      userId: user._id,
    });
    return { reset: true };
  },
});
