import { v } from "convex/values";
import {
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { constantTimeStringEquals } from "./lib/crypto";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";

// Generous per-IP cap: a real recovery submits a handful of times; bulk
// account enumeration from one IP is what this throttles.
const PHRASE_SALT_RATE_LIMIT_MAX = 20;

const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns the Argon2id salt the client needs to derive the RootKey at login.
 * The salt itself is non-sensitive (it's stored in clear server-side by
 * design), but to limit email enumeration we only return it when an
 * `encryptedKeyBundle` has actually been set for the user.
 *
 * A mutation (not a query) so it can enforce a per-IP rate limit on the
 * server-attested `_audit` IP before exposing the lookup in production. The
 * limit is counted on every hit — including misses — so enumeration of
 * non-existent accounts is throttled too.
 */
export const getPhraseSaltByEmail = mutation({
  args: { email: v.string(), _audit: auditContextValidator },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "phrase_salt",
      args._audit.ip,
      PHRASE_SALT_RATE_LIMIT_MAX,
    );

    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user || !user.phraseSalt || !user.encryptedKeyBundle) {
      return null;
    }
    return {
      phraseSalt: user.phraseSalt,
      encryptedKeyBundle: user.encryptedKeyBundle,
    };
  },
});

/**
 * Internal helper — verifies the recovery phrase hash for the given email
 * and returns the user id when it matches. Used by the reset action below.
 *
 * Email-only: passwordless phone accounts have no password to reset; their
 * lost-phone recovery uses the `phone-recovery` ConvexCredentials provider.
 */
export const verifyRecoveryPhraseInternal = internalQuery({
  args: { email: v.string(), phraseHash: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user || !user.recoveryPhraseHash) return null;
    // SECURITY: constant-time compare; `phraseHash` carries the client-computed
    // salted Argon2id verifier (derivePhraseVerifier), never the raw phrase.
    if (!constantTimeStringEquals(user.recoveryPhraseHash, args.phraseHash)) {
      return null;
    }
    return user._id as Id<"users">;
  },
});

/**
 * Reset the user's Convex Auth password using the 24-word recovery phrase.
 *
 * This action does NOT touch the encrypted vault key bundle — the RootKey
 * is derived from the unchanged 24-word phrase, so the vault remains
 * unlockable as before. Only the auth credential is rotated, and all other
 * sessions are invalidated for safety.
 */
export const resetPasswordWithRecovery = action({
  args: {
    email: v.string(),
    phraseHash: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    const email = normalizeEmail(args.email);

    const userId = (await ctx.runQuery(
      internal.passwordReset.verifyRecoveryPhraseInternal,
      { email, phraseHash: args.phraseHash },
    )) as Id<"users"> | null;
    if (!userId) {
      throw new Error("Invalid recovery phrase");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });

    await invalidateSessions(ctx, { userId });
  },
});
