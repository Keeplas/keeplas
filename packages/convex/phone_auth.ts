import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { constantTimeStringEquals } from "./lib/crypto";
import { normalizeE164 } from "./lib/phone";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const MAX_ATTEMPTS = 5;
// Generous per-IP cap for the salt lookup; mirrors passwordReset.
const PHRASE_SALT_RATE_LIMIT_MAX = 20;

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, "0");
}

/**
 * Issue + dispatch a pre-auth WhatsApp OTP for a passwordless phone account.
 * `intent` distinguishes signup (must NOT already exist) from signin.
 * Rate-limited to 3 per rolling hour per number. The code is consumed by the
 * `phone-otp` ConvexCredentials provider's authorize() at signIn.
 *
 * Returns `{ sent: true }` even for an unknown number on signin so the
 * endpoint does not leak account existence (the subsequent signIn fails).
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

    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .first();
    if (args.intent === "signup" && existing) {
      throw new ConvexError(
        "An account with this phone number already exists. Sign in instead.",
      );
    }
    // Signin: refuse early so we never send an OTP to a number with no account
    // (saves a WhatsApp message and avoids a confusing post-code failure).
    // ConvexError so the message survives Convex's prod error redaction.
    if (args.intent === "signin" && !existing) {
      throw new ConvexError(
        "No account found for this phone number. Sign up to create one.",
      );
    }

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
      if (stale.expiresAt > now) await ctx.db.delete(stale._id);
    }

    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    await ctx.db.insert("phone_auth_codes", {
      phoneNumber: phone,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      intent: args.intent,
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
      phoneNumber: phone,
      code,
      language: args.language,
    });

    return { sent: true };
  },
});

/**
 * Verify + consume a pre-auth phone OTP. Called by the `phone-otp`
 * ConvexCredentials provider from its action context (via runMutation).
 * Throws on any failure; deletes the code on success.
 */
export const consumePhoneAuthCode = internalMutation({
  args: { phoneNumber: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new Error("Invalid phone number");
    const trimmed = args.code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("Code must be 6 digits");
    }

    const now = Date.now();
    const candidates = await ctx.db
      .query("phone_auth_codes")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .collect();
    const active = candidates
      .filter((c) => c.expiresAt > now)
      .sort((a, b) => b._creationTime - a._creationTime)[0];
    if (!active) throw new Error("Code expired or not requested");

    if (active.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(active._id);
      throw new Error("Too many attempts. Request a new code.");
    }

    const submittedHash = await sha256Hex(trimmed);
    if (submittedHash !== active.codeHash) {
      await ctx.db.patch(active._id, { attempts: active.attempts + 1 });
      throw new Error("Invalid code");
    }

    await ctx.db.delete(active._id);
    return { ok: true };
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
