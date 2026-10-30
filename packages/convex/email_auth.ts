import { v, ConvexError } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { constantTimeStringEquals, sha256Hex } from "./lib/crypto";
import { isValidEmail, normalizeEmail } from "./lib/email";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { MOBILE_ONLY_SIGNUP } from "./attestation";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";

// Sibling of phone_auth.ts for the passwordless `email-otp` provider. Mirrors
// its hashing/expiry/attempts/rate-limit semantics; the only difference is the
// channel (emailed code via Resend instead of WhatsApp).

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
// Per server-attested IP, across addresses; mirrors the phrase-salt lookup.
const IP_RATE_LIMIT_MAX = 20;
// Password sign-in attempts per server-attested IP and hour, across accounts.
const PASSWORD_SIGN_IN_IP_MAX = 20;

/**
 * Issue + dispatch a pre-auth email OTP for an existing account. `signup` is
 * refused (mobile-only sign-up, F8). The code is consumed by the `email-otp`
 * ConvexCredentials provider's authorize().
 * Rate-limited to 3 per rolling hour per address and 20 per IP. An unknown
 * address gets the same `{ sent: true }` and no email, so the endpoint does
 * not tell whether an account exists (misses still count toward the IP
 * limit, as they do not throw).
 */
export const requestEmailAuthOtp = mutation({
  args: {
    email: v.string(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
    language: v.optional(v.string()),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) throw new Error("Invalid email address");

    // Sign-up is mobile-only (F8): no code is ever issued to create an
    // email account.
    if (args.intent === "signup") throw new ConvexError(MOBILE_ONLY_SIGNUP);

    await enforceIpRateLimit(
      ctx,
      "email_auth_otp",
      args._audit.ip,
      IP_RATE_LIMIT_MAX,
    );
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!existing) return { sent: true };

    const now = Date.now();
    const recent = await ctx.db
      .query("email_auth_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.gt(q.field("_creationTime"), now - RATE_LIMIT_WINDOW_MS))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new Error("Too many verification attempts. Try again later.");
    }
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
    }

    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    await ctx.db.insert("email_auth_codes", {
      email,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      intent: args.intent,
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.sendEmailOtp, {
      email,
      code,
      language: args.language,
    });

    return { sent: true };
  },
});

/**
 * Count a password sign-in attempt against the caller's server-attested IP
 * (the `password` provider in auth.ts calls it first). The library only
 * limits failures per account, so without it one client could try passwords
 * across every account. It commits in its own transaction, so the hit counts
 * even when the sign-in then fails.
 */
export const throttlePasswordSignIn = internalMutation({
  args: { _audit: auditContextValidator },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "password_sign_in",
      args._audit.ip,
      PASSWORD_SIGN_IN_IP_MAX,
    );
  },
});

/**
 * Verify + consume a pre-auth email OTP. Called by the `email-otp`
 * ConvexCredentials provider from its action context (via runMutation).
 * Throws on any failure; deletes the code on success.
 */
export const consumeEmailAuthCode = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) throw new Error("Invalid email address");
    const candidates = await ctx.db
      .query("email_auth_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const check = await checkOtp(ctx, candidates, args.code);
    if ("wrong" in check) return { ok: false as const, error: INVALID_CODE };

    await ctx.db.delete(check.active._id);
    return { ok: true as const };
  },
});

/**
 * Recovery for passwordless email accounts: resolve the user by email and
 * verify the 24-word recovery-phrase hash (constant-time). Used by the
 * `email-recovery` ConvexCredentials provider. Returns the userId on match,
 * else null. ZK: only a stored hash is compared, no crypto changes.
 */
export const verifyEmailRecovery = internalQuery({
  args: { email: v.string(), phraseHash: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user || !user.recoveryPhraseHash) return null;
    if (!constantTimeStringEquals(user.recoveryPhraseHash, args.phraseHash)) {
      return null;
    }
    return user._id;
  },
});
