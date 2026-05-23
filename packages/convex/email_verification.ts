import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAuth } from "./helpers";
import { isValidEmail, normalizeEmail } from "./lib/email";

// Settings-side add+verify of an email for an authenticated user, sibling of
// phone_verification.ts. On success it links a passwordless `email-otp` auth
// account to the CURRENT user so the email becomes a login method. The pending
// email lives on the code row (not on `users`) until verified, so an unverified
// address never lands on the user record or its index.

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
 * Reject if `email` is already used by another user. Throws a user-facing
 * message; the current user is allowed to re-request for the same pending
 * email. Defense-in-depth: enforced again at link time.
 */
async function assertEmailAvailable(
  ctx: QueryCtx,
  email: string,
  userId: Id<"users">,
): Promise<void> {
  const owner = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (owner && owner._id !== userId) {
    throw new Error("This email is already linked to another account.");
  }
}

/**
 * Issue + dispatch a fresh 6-digit code to verify ownership of `email` before
 * linking it. Rate-limited to 3 per rolling hour. Refuses if the account
 * already has an email or the address belongs to someone else.
 */
export const requestVerification = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) throw new Error("Invalid email address");

    // Allowed when the account has no VERIFIED email yet. A backfilled,
    // unverified email (from an invitation) is fine to verify — even to a
    // different address; we only block adding a second verified email.
    const user = await ctx.db.get(userId);
    if (user?.emailVerificationTime) {
      throw new Error("A verified email is already linked to this account.");
    }
    await assertEmailAvailable(ctx, email, userId);

    const now = Date.now();
    const recent = await ctx.db
      .query("email_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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
    await ctx.db.insert("email_verification_codes", {
      userId,
      email,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.sendEmailOtp, {
      email,
      code,
    });

    return { sent: true };
  },
});

/**
 * Validate the submitted code and, on success, link a passwordless `email-otp`
 * auth account to the current user and set `users.email` + verification time.
 * Atomic: any failure rolls back the whole mutation.
 */
export const verifyCodeAndLink = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const trimmed = args.code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("Code must be 6 digits");
    }

    const now = Date.now();
    const candidates = await ctx.db
      .query("email_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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

    const email = active.email;
    // Re-check at the security boundary (transactional): the account must still
    // have no VERIFIED email and the address must still be free.
    const user = await ctx.db.get(userId);
    if (user?.emailVerificationTime) {
      await ctx.db.delete(active._id);
      throw new Error("A verified email is already linked to this account.");
    }
    await assertEmailAvailable(ctx, email, userId);

    await ctx.db.insert("authAccounts", {
      userId,
      provider: "email-otp",
      providerAccountId: email,
      emailVerified: email,
    });
    await ctx.db.patch(userId, {
      email,
      emailVerificationTime: now,
      updatedAt: now,
    });
    await ctx.db.delete(active._id);

    return { verified: true, email };
  },
});

export const getMyStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const now = Date.now();
    const codes = await ctx.db
      .query("email_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const pending = codes.find((c) => c.expiresAt > now);

    return {
      email: user.email ?? null,
      verifiedAt: user.emailVerificationTime ?? null,
      hasPendingCode: !!pending,
      pendingEmail: pending?.email ?? null,
      pendingExpiresAt: pending?.expiresAt ?? null,
    };
  },
});
