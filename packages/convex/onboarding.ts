import {
  mutation,
  query,
  internalMutation,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAuth, optionalAuth, getActiveItems } from "./helpers";
import { createAuditLog } from "./audit";

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors DEFAULT_CHANNELS in
// apps/web/src/app/(dashboard)/life-check/sections/constants.ts. WhatsApp is
// the primary channel (a reply confirms liveness); all channels fan out at
// once, so the legacy delayHours cascade field is intentionally omitted.
const DEFAULT_ACTIVE_CHANNELS = [
  { type: "whatsapp" as const, order: 1, isEnabled: true },
  { type: "push" as const, order: 2, isEnabled: true },
  { type: "email" as const, order: 3, isEnabled: true },
];

const DEFAULT_THRESHOLD_DAYS = 30;

/**
 * Seed a default Life Check config AND a default recipient group for a user.
 * Each step is independently idempotent — re-running only fills in what's
 * missing. Called at the end of onboarding so users land on a configured Life
 * Check + a ready-to-use "Trusted Contacts" group instead of empty shells.
 */
export async function seedDefaults(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ configCreated: boolean; groupCreated: boolean }> {
  const now = Date.now();

  const existingConfig = await ctx.db
    .query("life_check_configs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  let configCreated = false;
  if (!existingConfig) {
    await ctx.db.insert("life_check_configs", {
      userId,
      frequency: "monthly",
      inactivityThresholdDays: DEFAULT_THRESHOLD_DAYS,
      lastActivityAt: now,
      activeChannels: DEFAULT_ACTIVE_CHANNELS,
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now + DEFAULT_THRESHOLD_DAYS * DAY_MS,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "system",
      actorId: "onboarding_seeder",
      action: "life_check_seeded",
      resourceType: "life_check_config",
      resourceId: userId,
    });
    configCreated = true;
  }

  const existingDefaultGroup = await ctx.db
    .query("recipient_groups")
    .withIndex("by_user_default", (q) =>
      q.eq("userId", userId).eq("isDefault", true),
    )
    .first();

  // Collect the user's current non-revoked trust contacts — used both to
  // pre-populate a freshly-seeded group and to repair an empty pre-existing
  // one (migration signal: see top-up branch below). Mirrors the membership
  // rule from the one-shot `migrateRecipients` in migrations.ts.
  const existingTrustContactIds = (
    await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect()
  )
    .filter((c) => (c.contactType ?? "trust") === "trust")
    .map((c) => c._id);

  let groupCreated = false;
  if (!existingDefaultGroup) {
    const groupId = await ctx.db.insert("recipient_groups", {
      userId,
      name: "Trusted Contacts",
      description:
        "Default group — every trusted contact you invite is added here automatically.",
      memberContactIds: existingTrustContactIds,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "system",
      actorId: "onboarding_seeder",
      action: "recipient_group.seeded",
      resourceType: "recipient_group",
      resourceId: groupId,
    });
    groupCreated = true;
  } else if (
    existingDefaultGroup.memberContactIds.length === 0 &&
    existingTrustContactIds.length > 0
  ) {
    // One-shot repair: an earlier version of this helper seeded the default
    // group with an empty `memberContactIds`, leaving users who already had
    // trust contacts on a routing-broken fallback. An empty default group is
    // not a legitimate steady state (recipientMode=default → nobody), so we
    // backfill it with the user's existing trust contacts. After this runs
    // the condition is false and we never overwrite manual edits.
    await ctx.db.patch(existingDefaultGroup._id, {
      memberContactIds: existingTrustContactIds,
      updatedAt: now,
    });
  }

  return { configCreated, groupCreated };
}

/**
 * Idempotent self-heal entry point for the dashboard. Existing users who
 * finished onboarding before `seedDefaults` covered recipient groups never
 * received the default "Trusted Contacts" group — this mutation lets the
 * frontend top them up the first time they visit the relevant page, without
 * requiring a CLI-triggered backfill. Safe to call repeatedly: the helper
 * short-circuits when both the Life Check config and the default group exist.
 */
export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await seedDefaults(ctx, userId);
  },
});

/**
 * Get the current user's onboarding state.
 */
export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      onboardingStep: user.onboardingStep ?? "auth_complete",
      recoveryVerified: user.recoveryVerified ?? false,
      hasEncryptedKeyBundle: !!user.encryptedKeyBundle,
      vaultThreshold: user.vaultThreshold ?? null,
      language: user.language ?? null,
    };
  },
});

/**
 * Initialize onboarding after authentication.
 * Sets onboardingStep to "recovery_phrase" if user hasn't started yet.
 */
export const initOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Only initialize if not already started
    if (!user.onboardingStep) {
      await ctx.db.patch(userId, {
        onboardingStep: "auth_complete",
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Advance onboarding to the next step.
 */
export const advanceOnboardingStep = mutation({
  args: {
    step: v.union(
      v.literal("auth_complete"),
      v.literal("legal_info"),
      v.literal("recovery_phrase"),
      v.literal("verification"),
      v.literal("key_generation"),
      v.literal("complete"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    await ctx.db.patch(userId, {
      onboardingStep: args.step,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store the salted recovery-phrase verifier after the user verifies their
 * words. The verifier is a salted Argon2id digest (derivePhraseVerifier),
 * computed client-side — NEVER the phrase itself. The `phraseSalt` is the
 * same per-user salt later reused by storeKeyBundle for the RootKey: it is
 * persisted here so the salted verifier can be recomputed on later recovery,
 * since verification precedes key generation in the onboarding flow.
 */
export const storeRecoveryPhraseHash = mutation({
  args: {
    recoveryPhraseHash: v.string(),
    phraseSalt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    await ctx.db.patch(userId, {
      recoveryPhraseHash: args.recoveryPhraseHash,
      phraseSalt: args.phraseSalt,
      recoveryVerified: true,
      onboardingStep: "verification",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store the encrypted key bundle, the Argon2id phrase salt, and the chosen
 * Shamir threshold after key generation. All values are produced client-side —
 * the server never sees plaintext keys nor the recovery phrase.
 *
 * The server deliberately holds NO Shamir shard (finding #3): a server-held
 * shard plus one trusted-contact shard would reach a threshold-2 quorum and
 * let a malicious server reconstruct the master key on its own, breaking
 * zero-knowledge. Only the device (client) and trusted contacts hold shards.
 */
export const storeKeyBundle = mutation({
  args: {
    encryptedKeyBundle: v.string(),
    phraseSalt: v.string(),
    vaultThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.vaultThreshold < 2 || args.vaultThreshold > 3) {
      throw new Error("vaultThreshold must be between 2 and 3");
    }

    const user = await ctx.db.get(userId);
    // Send the welcome message only on the first time onboarding completes —
    // `welcomeSentAt` is the idempotency guard against a re-invoked storeKeyBundle.
    const sendWelcome = user != null && !user.welcomeSentAt;

    await ctx.db.patch(userId, {
      encryptedKeyBundle: args.encryptedKeyBundle,
      phraseSalt: args.phraseSalt,
      vaultThreshold: args.vaultThreshold,
      onboardingStep: "complete",
      updatedAt: Date.now(),
      ...(sendWelcome ? { welcomeSentAt: Date.now() } : {}),
    });

    await seedDefaults(ctx, userId);

    // Thank the user and nudge the 3 priority actions, across whichever channels
    // they reachable on. Both are graceful no-ops when the provider is
    // unconfigured (email) / the Infobip template isn't approved yet (WhatsApp).
    if (sendWelcome && user) {
      if (user.email) {
        await ctx.scheduler.runAfter(0, internal.dispatch.sendWelcomeEmail, {
          email: user.email,
          name: user.name,
          language: user.language,
        });
      }
      if (user.phoneNumber) {
        await ctx.scheduler.runAfter(0, internal.dispatch.sendWelcomeWhatsApp, {
          phoneNumber: user.phoneNumber,
          name: user.name,
          language: user.language,
        });
      }

      // Drip reminders: re-check at day 3 and day 10 whether the user has still
      // not added a trusted contact and/or a vault item, and nudge them if so.
      // The check happens at fire time (sendSetupReminder), so a user who
      // finishes setup before then is never pinged.
      await ctx.scheduler.runAfter(
        3 * DAY_MS,
        internal.onboarding.sendSetupReminder,
        { userId, stage: "day3" },
      );
      await ctx.scheduler.runAfter(
        10 * DAY_MS,
        internal.onboarding.sendSetupReminder,
        { userId, stage: "day10" },
      );
    }
  },
});

/**
 * Fired by the scheduler 3 and 10 days after onboarding completes. Sends a
 * setup-completion reminder ONLY when the user still hasn't added a trusted
 * contact and/or a vault item — a user who has both is fully set up and gets
 * nothing. Delivers across whichever channels the user is reachable on; both
 * sends degrade gracefully when their provider is unconfigured.
 */
export const sendSetupReminder = internalMutation({
  args: {
    userId: v.id("users"),
    stage: v.union(v.literal("day3"), v.literal("day10")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.onboardingStep !== "complete") return;

    const trustContacts = (
      await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
        .collect()
    ).filter((c) => (c.contactType ?? "trust") === "trust");
    const items = await getActiveItems(ctx, args.userId);

    const missingContacts = trustContacts.length === 0;
    const missingItems = items.length === 0;
    // Fully set up — nothing to nudge.
    if (!missingContacts && !missingItems) return;

    if (user.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.dispatch.sendSetupReminderEmail,
        {
          email: user.email,
          name: user.name,
          language: user.language,
          stage: args.stage,
          missingContacts,
          missingItems,
        },
      );
    }
    if (user.phoneNumber) {
      await ctx.scheduler.runAfter(
        0,
        internal.dispatch.sendSetupReminderWhatsApp,
        {
          phoneNumber: user.phoneNumber,
          name: user.name,
          language: user.language,
        },
      );
    }
  },
});

/**
 * Backfill helper: seed default Life Check config + default recipient group
 * for every existing user that already finished onboarding but predates the
 * seeding logic. Idempotent — each piece is a no-op when already present.
 */
export const seedDefaultsForExistingUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let configsCreated = 0;
    let groupsCreated = 0;

    for (const user of users) {
      if (user.onboardingStep !== "complete") continue;
      const result = await seedDefaults(ctx, user._id);
      if (result.configCreated) configsCreated++;
      if (result.groupCreated) groupsCreated++;
    }

    return { configsCreated, groupsCreated };
  },
});
