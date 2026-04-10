import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current user's onboarding state.
 */
export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      onboardingStep: user.onboardingStep ?? "auth_complete",
      recoveryVerified: user.recoveryVerified ?? false,
      hasEncryptedKeyBundle: !!user.encryptedKeyBundle,
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

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
      v.literal("recovery_phrase"),
      v.literal("verification"),
      v.literal("key_generation"),
      v.literal("complete")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

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
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    await ctx.db.patch(userId, {
      recoveryPhraseHash: args.recoveryPhraseHash,
      recoveryVerified: true,
      onboardingStep: "verification",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store the encrypted key bundle and Keeplas shard after key generation.
 * These are encrypted client-side — the server never sees plaintext keys.
 */
export const storeKeyBundle = mutation({
  args: {
    encryptedKeyBundle: v.string(),
    keeplasShard: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    await ctx.db.patch(userId, {
      encryptedKeyBundle: args.encryptedKeyBundle,
      keeplasShard: args.keeplasShard,
      onboardingStep: "complete",
      vaultIntegrityScore: 0,
      updatedAt: Date.now(),
    });
  },
});
