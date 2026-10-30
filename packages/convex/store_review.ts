import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { createAuditLog } from "./audit";
import { getActiveItems, getUserByPhone } from "./helpers";
import {
  enterTravelMode,
  findInFlightCycle,
  TRAVEL_MODE_MAX_DAYS,
} from "./life_check";
import { isReviewPhone, listedPhones, normalizeE164 } from "./lib/phone";
import { cancelOpenRequest, openRequest } from "./number_change";
import { activeRequest, cancelActiveRecovery } from "./recovery";

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
const DAY_MS = 24 * 60 * 60 * 1000;
// A demo account's Life check must stay paused through any review: travel
// mode ending sooner than this counts as off (status flags it, clearDrift
// re-arms it).
const TRAVEL_MODE_MARGIN_MS = 14 * DAY_MS;

/** The E.164 number if REVIEW_PHONES lists it: real accounts are off-limits. */
function requireReviewPhone(phoneNumber: string): string {
  const phone = normalizeE164(phoneNumber);
  if (!phone || !isReviewPhone(phone)) {
    throw new ConvexError(
      "Not a review number: only accounts listed in REVIEW_PHONES can be changed here",
    );
  }
  return phone;
}

/**
 * Refuse a number or email change on a review account (phone_verification,
 * email_verification and the signed-out "Lost your number?" request in
 * number_change). The demo accounts are shared by every reviewer, and a
 * sign-up account must keep its number so `pnpm review:reset` can erase it.
 * The app matches this message (mobile features/account/errors.ts).
 */
export async function refuseOnReviewAccount(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (isReviewPhone(user?.phoneNumber)) {
    throw new ConvexError(
      "Review accounts can't change their number or email.",
    );
  }
}

/**
 * Whether this Life check could start a cycle (the full-screen "Are you
 * okay?" check-in) during a review: it is on and travel mode is off or ends
 * within the margin. Travel mode with no end date never ends.
 */
function canStartSoon(config: Doc<"life_check_configs">, now: number) {
  if (!config.isActive) return false;
  if (!config.travelModeEnabled) return true;
  return (
    config.travelModeUntil !== undefined &&
    config.travelModeUntil < now + TRAVEL_MODE_MARGIN_MS
  );
}

/** Contacts' emergency access requests on this vault, by status. */
async function countAccessRequests(
  ctx: QueryCtx,
  userId: Id<"users">,
  status: "pending" | "approved",
) {
  return (
    await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", userId).eq("status", status),
      )
      .take(MAX_COUNTED_ITEMS)
  ).length;
}

/**
 * Whether each review number is ready for a submission, including what an
 * earlier reviewer may have left on it (devices waiting for "It was me", a
 * pending key rotation, the cloud backup turned on, another language, an
 * email, items or contacts) and the succession state: whether the Life check
 * can start a check-in soon or has one in flight, the contacts' access
 * requests and an open recovery or number change request. Reports
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
      // What the app lists: items deleted in the app are only archived.
      const items = await getActiveItems(ctx, user._id);
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
      const cycle = await findInFlightCycle(ctx, user._id);
      const recovery = await activeRequest(ctx, user._id);
      const numberChange = await openRequest(ctx, user._id);
      accounts.push({
        phoneNumber,
        account: {
          name: user.name ?? null,
          plan: user.plan ?? "free",
          email: user.email ?? null,
          kitVerifier:
            user.phraseSalt && user.recoveryPhraseHash
              ? {
                  phraseSalt: user.phraseSalt,
                  recoveryPhraseHash: user.recoveryPhraseHash,
                }
              : null,
          items: items.length,
          // Every contact the People tab lists.
          contacts: contacts.filter(
            (contact) => contact.invitationStatus !== "revoked",
          ).length,
          contactsAccepted: contacts.filter(
            (contact) => contact.invitationStatus === "accepted",
          ).length,
          lifeCheck: lifeCheck
            ? {
                frequency: lifeCheck.frequency,
                travelMode: lifeCheck.travelModeEnabled,
                travelModeUntil: lifeCheck.travelModeUntil ?? null,
                canStartSoon: canStartSoon(lifeCheck, Date.now()),
                cycle: cycle?.status ?? null,
              }
            : null,
          // Pending: contacts are confirming a death; approved: released.
          accessRequests: {
            pending: await countAccessRequests(ctx, user._id, "pending"),
            approved: await countAccessRequests(ctx, user._id, "approved"),
          },
          recoveryRequest: recovery?.status ?? null,
          // "Lost your number?" on the demo number: a banner on Home.
          numberChangeRequest: numberChange?.status ?? null,
          deletionScheduled: Boolean(user.deletionScheduledAt),
          devicesPending: devices.filter(isPendingDevice).length,
          masterKeyRotationRequired: Boolean(user.masterKeyRotationRequired),
          // On, or never turned off: the next phone would back it up.
          cloudBackup: backup !== null || !user.cloudBackupOffAt,
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
 * kit), set the language back to English, pause the Life check with travel
 * mode for the maximum (ending a check-in or a contacts' confirmation in
 * flight), cancel a recovery or number change request, revoke invitations
 * nobody accepted (the seeded contacts did) and remove an added email. The seed
 * runs it too, to pause the Life check. A new kit, a pending key rotation, a
 * purchase, a deletion request or a released vault need a re-seed instead.
 * Refuses any number outside REVIEW_PHONES.
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
    const backupTurnedOff = backups.length > 0 || !user.cloudBackupOffAt;

    // Travel mode again for the maximum, as the app's switch does: it also
    // ends a check-in in flight and denies the contacts' pending requests.
    const lifeCheck = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const lifeCheckPaused =
      lifeCheck !== null &&
      (canStartSoon(lifeCheck, now) ||
        (await findInFlightCycle(ctx, user._id)) !== null ||
        (await countAccessRequests(ctx, user._id, "pending")) > 0);
    if (lifeCheckPaused) {
      await enterTravelMode(
        ctx,
        lifeCheck,
        now + TRAVEL_MODE_MAX_DAYS * DAY_MS,
        now,
      );
    }

    // As the owner's "It wasn't me, cancel it" does.
    const recoveryCancelled = await cancelActiveRecovery(ctx, user._id);
    const numberChangeCancelled =
      (await cancelOpenRequest(ctx, user._id)) !== null;

    // Someone a reviewer invited: the next reviewer would see them on the
    // People tab. As the app's "Remove" does.
    const invited = (
      await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect()
    ).filter(
      (contact) =>
        contact.invitationStatus === "pending" ||
        contact.invitationStatus === "declined",
    );
    for (const contact of invited) {
      await ctx.db.patch(contact._id, {
        invitationStatus: "revoked",
        updatedAt: now,
      });
    }

    // A reviewer's own address: it would get the next reviewers' alerts and
    // could sign in to the demo account by email.
    const emailRemoved = user.email !== undefined;
    if (emailRemoved) {
      const emailLogins = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", user._id).eq("provider", "email-otp"),
        )
        .collect();
      for (const login of emailLogins) await ctx.db.delete(login._id);
    }

    const languageReset =
      user.language !== undefined && !user.language.startsWith("en");
    const result = {
      devicesConfirmed: pending.length,
      backupTurnedOff,
      languageReset,
      lifeCheckPaused,
      recoveryCancelled,
      emailRemoved,
      numberChangeCancelled,
      invitationsRevoked: invited.length,
    };
    if (backupTurnedOff || languageReset || emailRemoved) {
      await ctx.db.patch(user._id, {
        ...(backupTurnedOff ? { cloudBackupOffAt: now } : {}),
        ...(languageReset ? { language: REVIEW_LANGUAGE } : {}),
        ...(emailRemoved
          ? { email: undefined, emailVerificationTime: undefined }
          : {}),
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
