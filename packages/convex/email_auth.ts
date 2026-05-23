import { v, ConvexError } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { isValidEmail, normalizeEmail } from "./lib/email";

// Sibling of phone_auth.ts for the passwordless `email-otp` provider. Mirrors
// its hashing/expiry/attempts/rate-limit semantics; the only difference is the
// channel (emailed code via Resend instead of WhatsApp).

function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const MAX_ATTEMPTS = 5;

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
 * Issue + dispatch a pre-auth email OTP for a passwordless email account.
 * `intent` distinguishes signup (must NOT already exist) from signin. The code
 * is consumed by the `email-otp` ConvexCredentials provider's authorize().
 * Rate-limited to 3 per rolling hour per address. ConvexError on existence
 * mismatches so the message survives prod error redaction.
 */
export const requestEmailAuthOtp = mutation({
  args: {
    email: v.string(),
    intent: v.union(v.literal("signup"), v.literal("signin")),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) throw new Error("Invalid email address");

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (args.intent === "signup" && existing) {
      throw new ConvexError(
        "An account with this email already exists. Sign in instead.",
      );
    }
    if (args.intent === "signin" && !existing) {
      throw new ConvexError(
        "No account found for this email. Sign up to create one.",
      );
    }

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
      if (stale.expiresAt > now) await ctx.db.delete(stale._id);
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
    });

    return { sent: true };
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
    const trimmed = args.code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("Code must be 6 digits");
    }

    const now = Date.now();
    const candidates = await ctx.db
      .query("email_auth_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
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
