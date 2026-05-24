import {
  mutation,
  query,
  internalMutation,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, optionalAuth } from "./helpers";
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

const DEFAULT_PASSIVE_SIGNALS = {
  appActivity: true,
  deviceActivity: false,
  gpsMovement: false,
  whatsappActivity: false,
  googleActivity: false,
  healthData: false,
  appleWatch: false,
};

const DEFAULT_THRESHOLD_DAYS = 30;

/**
 * Seed a default Life Check config for a user. Idempotent: skips if a config
 * already exists. Called at the end of onboarding so users land on a configured
 * Life Check instead of an empty form.
 */
export async function seedDefaults(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ configCreated: boolean }> {
  const now = Date.now();

  const existingConfig = await ctx.db
    .query("life_check_configs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existingConfig) return { configCreated: false };

  await ctx.db.insert("life_check_configs", {
    userId,
    frequency: "monthly",
    inactivityThresholdDays: DEFAULT_THRESHOLD_DAYS,
    lastActivityAt: now,
    passiveSignals: DEFAULT_PASSIVE_SIGNALS,
    activeChannels: DEFAULT_ACTIVE_CHANNELS,
    travelModeEnabled: false,
    expeditionMode: false,
    isActive: true,
    nextCheckAt: now + DEFAULT_THRESHOLD_DAYS * DAY_MS,
    confidenceThreshold: 50,
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

  return { configCreated: true };
}

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
 * Store the recovery phrase hash after user verifies their words.
 * Only the SHA-256 hash is stored — NEVER the phrase itself.
 */
export const storeRecoveryPhraseHash = mutation({
  args: {
    recoveryPhraseHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    await ctx.db.patch(userId, {
      recoveryPhraseHash: args.recoveryPhraseHash,
      recoveryVerified: true,
      onboardingStep: "verification",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store the encrypted key bundle, the Argon2id phrase salt, and the Keeplas
 * Shamir shard after key generation. All values are produced client-side —
 * the server never sees plaintext keys nor the recovery phrase.
 */
export const storeKeyBundle = mutation({
  args: {
    encryptedKeyBundle: v.string(),
    phraseSalt: v.string(),
    keeplasShard: v.string(),
    vaultThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.vaultThreshold < 2 || args.vaultThreshold > 3) {
      throw new Error("vaultThreshold must be between 2 and 3");
    }

    await ctx.db.patch(userId, {
      encryptedKeyBundle: args.encryptedKeyBundle,
      phraseSalt: args.phraseSalt,
      keeplasShard: args.keeplasShard,
      vaultThreshold: args.vaultThreshold,
      onboardingStep: "complete",
      vaultIntegrityScore: 0,
      updatedAt: Date.now(),
    });

    await seedDefaults(ctx, userId);
  },
});

/**
 * Backfill helper: seed a default Life Check config for every existing user
 * that already finished onboarding but predates the seeding logic. Idempotent —
 * re-running it is a no-op for users that already have a config.
 */
export const seedDefaultsForExistingUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let configsCreated = 0;

    for (const user of users) {
      if (user.onboardingStep !== "complete") continue;
      const result = await seedDefaults(ctx, user._id);
      if (result.configCreated) configsCreated++;
    }

    return { configsCreated };
  },
});
