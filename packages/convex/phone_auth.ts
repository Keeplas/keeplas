import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { sha256Hex, verifierMatches } from "./lib/crypto";
import { listedPhones, normalizeE164 } from "./lib/phone";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { consumeSignupGrant } from "./attestation";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
// Generous per-IP cap for the salt lookup; mirrors passwordReset.
const PHRASE_SALT_RATE_LIMIT_MAX = 20;

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
  if (
    /^\d{6}$/.test(reviewCode) &&
    listedPhones(process.env.REVIEW_PHONES).includes(phone)
  ) {
    return reviewCode;
  }
  return null;
}

/**
 * Issue + dispatch a pre-auth WhatsApp OTP for a passwordless phone account.
 * `intent` distinguishes signup (must NOT already exist) from signin.
 * Rate-limited to 3 per rolling hour per number. The code is consumed by the
 * `phone-otp` ConvexCredentials provider's authorize() at signIn.
 *
 * Account existence is never told to an anonymous caller:
 * - signin on an unknown number returns `{ sent: true }` and sends nothing
 *   (no WhatsApp message to a number without an account);
 * - signup first needs the app's attestation grant (M09-9), so only a
 *   genuine app on a real device, once per number, learns that a number is
 *   taken ("already exists", which the app turns into "Sign in instead").
 */
export const requestPhoneAuthOtp = mutation({
  args: {
    phoneNumber: v.string(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new Error("Invalid phone number");

    // Mobile-only sign-up: the app must have attested first (M09-9).
    if (args.intent === "signup") await consumeSignupGrant(ctx, phone);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .first();
    // ConvexError so the message survives Convex's prod error redaction.
    if (args.intent === "signup" && existing) {
      throw new ConvexError(
        "An account with this phone number already exists. Sign in instead.",
      );
    }
    if (args.intent === "signin" && !existing) return { sent: true };

    const now = Date.now();
    const recent = await ctx.db
      .query("phone_auth_codes")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .filter((q) => q.gt(q.field("_creationTime"), now - RATE_LIMIT_WINDOW_MS))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new Error("Too many verification attempts. Try again later.");
    }
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
    }

    const fixed = fixedCode(phone);
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

    return { sent: true };
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
    if (!phone) throw new Error("Invalid phone number");
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
    if (!(await verifierMatches(user.recoveryPhraseHash, args.phraseHash))) {
      return null;
    }
    return user._id;
  },
});
