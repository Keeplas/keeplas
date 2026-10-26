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
 * number. These internal functions back `pnpm review:status` and
 * `pnpm review:reset` (scripts/review-accounts.mjs); clients never reach them.
 * Runbook: apps/mobile/APP_REVIEW.md.
 */

// A handful of numbers is plenty; the bound keeps the status reads small.
const MAX_REVIEW_PHONES = 10;
const MAX_COUNTED_ITEMS = 50;

/**
 * Whether each review number is ready for a submission. Reports the code as
 * "set", "missing" or "invalid", never its value.
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
      accounts.push({
        phoneNumber,
        account: {
          name: user.name ?? null,
          plan: user.plan ?? "free",
          recoveryKit: Boolean(user.recoveryPhraseHash),
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
        },
      });
    }
    return { code, accounts };
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
    const phone = normalizeE164(args.phoneNumber);
    if (!phone || !listedPhones(process.env.REVIEW_PHONES).includes(phone)) {
      throw new ConvexError(
        "Not a review number: only accounts listed in REVIEW_PHONES can be reset",
      );
    }
    const user = await getUserByPhone(ctx, phone);
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
