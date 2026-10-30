import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { constantTimeStringEquals, sha256Hex } from "./lib/crypto";
import { isReviewPhone, listedPhones, normalizeE164 } from "./lib/phone";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { consumeSignupGrant } from "./attestation";
import {
  checkOtp,
  generateOtp,
  INVALID_CODE,
  OTP_MAX_ATTEMPTS,
} from "./lib/otp";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
// Generous per-IP cap for the salt lookup; mirrors passwordReset.
const PHRASE_SALT_RATE_LIMIT_MAX = 20;
/** Code requests one IP may make per hour, across numbers (carrier NAT). */
export const CODE_REQUESTS_PER_IP = 20;

const DEV_TEST_CODE = "000000";

/**
 * The fixed code a number may use instead of a WhatsApp one, if any:
 * - DEV_TEST_PHONES → 000000 (dev deployments only; the prod deploy guard
 *   refuses it).
 * - REVIEW_PHONES → the secret 6-digit REVIEW_CODE, so App Store / Play
 *   reviewers can sign in to the demo account given in the review notes and
 *   try sign-up on a spare listed number (`pnpm review:reset` frees it again).
 *   Safe on prod: the code is a secret, only listed numbers accept it, and
 *   sign-up still needs the app's attestation grant (consumeSignupGrant), so
 *   only the genuine app on a real device can create one of these accounts.
 */
function fixedCode(phone: string): string | null {
  if (listedPhones(process.env.DEV_TEST_PHONES).includes(phone)) {
    return DEV_TEST_CODE;
  }
  const reviewCode = process.env.REVIEW_CODE ?? "";
  if (/^\d{6}$/.test(reviewCode) && isReviewPhone(phone)) {
    return reviewCode;
  }
  return null;
}

/**
 * Issue + dispatch a pre-auth WhatsApp OTP for a passwordless phone account.
 * `intent` distinguishes signup (must NOT already exist) from signin.
 * Rate-limited to 3 per rolling hour per number (a fixed-code number: 15
 * wrong guesses per hour instead) and to CODE_REQUESTS_PER_IP per hour per
 * IP. The code is consumed by the `phone-otp` ConvexCredentials provider's
 * authorize() at signIn.
 *
 * It does tell whether a number has an account: the app needs it to offer
 * "Sign in instead" / "Create account" before any code is sent. That answer
 * is returned (`{ sent: false, error }`), not thrown, so the IP slot it took
 * is kept: a throw would roll it back and leave probing unthrottled.
 */
export const requestPhoneAuthOtp = mutation({
  args: {
    phoneNumber: v.string(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
    language: v.optional(v.string()),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new ConvexError("Invalid phone number");

    // A fixed-code number sends no WhatsApp and its account is no secret
    // (review notes, dev numbers): reviewers sharing one network must not
    // lock each other out.
    const fixed = fixedCode(phone);
    if (fixed === null) {
      await enforceIpRateLimit(
        ctx,
        "phone_otp",
        args._audit.ip,
        CODE_REQUESTS_PER_IP,
      );
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .first();
    if (args.intent === "signup" && existing) {
      return {
        sent: false as const,
        error:
          "An account with this phone number already exists. Sign in instead.",
      };
    }
    // Signin: answer early so we never send an OTP to a number with no
    // account (saves a WhatsApp message and avoids a confusing post-code
    // failure).
    if (args.intent === "signin" && !existing) {
      return {
        sent: false as const,
        error: "No account found for this phone number. Sign up to create one.",
      };
    }

    // Mobile-only sign-up: the app must have attested first (M09-9).
    if (args.intent === "signup") await consumeSignupGrant(ctx, phone);

    const now = Date.now();
    const recent = await ctx.db
      .query("phone_auth_codes")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .filter((q) => q.gt(q.field("_creationTime"), now - RATE_LIMIT_WINDOW_MS))
      .collect();
    // A fixed code sends no WhatsApp message, so asking again costs nothing
    // and a reviewer's repeated sign-ins must not lock the number. Only its
    // wrong guesses count, with the hourly budget of 3 WhatsApp codes: a new
    // request must not buy fresh tries at a code that never changes.
    const capped =
      fixed === null
        ? recent.length >= RATE_LIMIT_MAX
        : recent.reduce((sum, row) => sum + row.attempts, 0) >=
          RATE_LIMIT_MAX * OTP_MAX_ATTEMPTS;
    if (capped) {
      throw new ConvexError("Too many verification attempts. Try again later.");
    }
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
    }

    const code = fixed ?? generateOtp();
    const codeHash = await sha256Hex(code);
    await ctx.db.insert("phone_auth_codes", {
      phoneNumber: phone,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      intent: args.intent,
    });

    if (fixed === null) {
      await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
        phoneNumber: phone,
        code,
        language: args.language,
      });
    }

    return { sent: true as const };
  },
});

/**
 * Verify + consume a pre-auth phone OTP. Called by the `phone-otp`
 * ConvexCredentials provider from its action context (via runMutation).
 * Throws on any failure; deletes the code on success.
 */
export const consumePhoneAuthCode = internalMutation({
  args: {
    phoneNumber: v.string(),
    code: v.string(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
  },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new ConvexError("Invalid phone number");
    // A sign-in code never creates an account: sign-up needs a code issued
    // against an attestation grant, so only codes of this flow count.
    const candidates = (
      await ctx.db
        .query("phone_auth_codes")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
        .collect()
    ).filter((c) => c.intent === args.intent);
    const check = await checkOtp(ctx, candidates, args.code);
    if ("wrong" in check) return { ok: false as const, error: INVALID_CODE };

    await ctx.db.delete(check.active._id);
    return { ok: true as const };
  },
});

/**
 * Returns the Argon2id `phraseSalt` for a phone account so the client can
 * derive the salted recovery-phrase verifier before lost-phone recovery.
 * Mirrors getPhraseSaltByEmail: the salt is non-sensitive but is only
 * returned once a recovery verifier has actually been configured.
 *
 * A mutation (not a query) so it can enforce a per-IP rate limit on the
 * server-attested `_audit` IP before exposing the lookup in production. Hits
 * are counted even on misses, throttling enumeration of non-existent accounts.
 */
export const getPhraseSaltByPhone = mutation({
  args: { phoneNumber: v.string(), _audit: auditContextValidator },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "phrase_salt",
      args._audit.ip,
      PHRASE_SALT_RATE_LIMIT_MAX,
    );

    const phone = normalizeE164(args.phoneNumber);
    if (!phone) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .first();
    if (!user || !user.phraseSalt || !user.recoveryPhraseHash) {
      return null;
    }
    return { phraseSalt: user.phraseSalt };
  },
});

/**
 * Lost-phone recovery for passwordless phone accounts: resolve the user by
 * phone and verify the 24-word recovery-phrase verifier (constant-time). Used
 * by the `phone-recovery` ConvexCredentials provider. Returns the userId on
 * match, else null. ZK: only a stored hash is compared, no crypto changes.
 */
export const verifyPhoneRecovery = internalQuery({
  args: { phoneNumber: v.string(), phraseHash: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .first();
    if (!user || !user.recoveryPhraseHash) return null;
    if (!constantTimeStringEquals(user.recoveryPhraseHash, args.phraseHash)) {
      return null;
    }
    return user._id;
  },
});
