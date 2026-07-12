import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy, countWhere, seriesByDay } from "./lib";

/** Total number of registered users, plus a billing-plan breakdown (the admin
 * `PlanBreakdown` card reads `byPlan`; undefined plan → "free"). */
export const userTotals = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return {
      total: users.length,
      byPlan: countBy(users, (u) => u.plan, "free"),
    };
  },
});

/** Users grouped by country of residence (undefined → "unknown"). */
export const usersByCountry = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return countBy(users, (u) => u.country);
  },
});

/** Users grouped by declared language. */
export const usersByLanguage = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return countBy(users, (u) => u.language);
  },
});

/** Enrolled auth methods across all users (a user may count in several). */
export const authMethods = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const out: Record<string, number> = {};
    for (const u of users) {
      for (const provider of u.authProviders ?? []) {
        out[provider] = (out[provider] ?? 0) + 1;
      }
    }
    return out;
  },
});

/** Verification funnel: how many users cleared each verification step. */
export const verificationStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return {
      total: users.length,
      recoveryVerified: countWhere(users, (u) => u.recoveryVerified === true),
      emailVerified: countWhere(users, (u) => u.emailVerificationTime != null),
      phoneVerified: countWhere(users, (u) => u.phoneNumberVerifiedAt != null),
      legalConfirmed: countWhere(users, (u) => u.legalInfoConfirmedAt != null),
    };
  },
});

/** Onboarding funnel: users grouped by their current onboarding step
 * (undefined → "not_started"). */
export const onboardingFunnel = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return countBy(users, (u) => u.onboardingStep, "not_started");
  },
});

/** Daily signup series, from each user's `_creationTime`, ascending by day.
 * Shape `{ day, count }` matches the admin front's `SignupBucket`. */
export const signupsOverTime = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return seriesByDay(users, (u) => u._creationTime).map(({ day, value }) => ({
      day,
      count: value,
    }));
  },
});

/**
 * "At-risk" / incomplete-setup segments — counts of distinct users who are
 * missing a key part of the succession setup. Built from single table scans
 * joined in memory (fine at current volume).
 *
 * - noTrustedContacts:  no trusted_contacts row at all.
 * - noVaultItems:       no vault_items row at all.
 * - lifeCheckNeverReset: has a life_check_config but never recorded an explicit
 *   liveness reset (`lastActivityAt` unset).
 * - incompleteOnboarding: onboardingStep is anything other than "complete".
 */
export const riskSegments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const contacts = await ctx.db.query("trusted_contacts").collect();
    const items = await ctx.db.query("vault_items").collect();
    const configs = await ctx.db.query("life_check_configs").collect();

    const usersWithContacts = new Set(contacts.map((c) => c.userId));
    const usersWithItems = new Set(items.map((i) => i.userId));
    const configResetByUser = new Map(
      configs.map((c) => [c.userId, c.lastActivityAt != null]),
    );

    return {
      noTrustedContacts: countWhere(
        users,
        (u) => !usersWithContacts.has(u._id),
      ),
      noVaultItems: countWhere(users, (u) => !usersWithItems.has(u._id)),
      lifeCheckNeverReset: countWhere(
        users,
        (u) => configResetByUser.get(u._id) === false,
      ),
      incompleteOnboarding: countWhere(
        users,
        (u) => u.onboardingStep !== "complete",
      ),
    };
  },
});

/** Histogram of vault-item counts per user (bucketed), keyed by bucket label. */
export const itemsPerUserDistribution = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const items = await ctx.db.query("vault_items").collect();

    const countByUser = new Map<string, number>();
    for (const i of items) {
      countByUser.set(i.userId, (countByUser.get(i.userId) ?? 0) + 1);
    }

    const buckets: Record<string, number> = {
      "0": 0,
      "1-5": 0,
      "6-20": 0,
      "20+": 0,
    };
    for (const u of users) {
      const n = countByUser.get(u._id) ?? 0;
      const key = n === 0 ? "0" : n <= 5 ? "1-5" : n <= 20 ? "6-20" : "20+";
      buckets[key]++;
    }
    return buckets;
  },
});
