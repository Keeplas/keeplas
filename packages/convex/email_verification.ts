import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { requireAuth, requireFullAuth } from "./helpers";
import { requireSessionProof } from "./session_proofs";
import { isValidEmail, normalizeEmail } from "./lib/email";
import { sha256Hex } from "./lib/crypto";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { refuseOnReviewAccount } from "./store_review";

// Settings-side add OR change of the user's email. On success it links a
// passwordless `email-otp` auth account to the CURRENT user and, when the
// user already had a verified email, re-points existing `password`/`email-otp`
// auth accounts at the new identifier so the old email stops authenticating.
// The pending email lives on the code row (not on `users`) until verified, so
// an unverified address never lands on the user record or its index.

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

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
    throw new ConvexError("This email is already linked to another account.");
  }
}

/**
 * Issue + dispatch a fresh 6-digit code to verify ownership of `email` before
 * linking it (add flow) or replacing the current verified one (change flow).
 * Rate-limited to 3 per rolling hour. Refuses if the user is trying to verify
 * the same address they already have, or if the address belongs to someone
 * else.
 *
 * The address becomes a login method and the login-OTP channel, so the
 * session must clear every step-up gate first. Replacing a verified address
 * also needs a "phone" or "vault" proof, like a number change
 * (phone_verification.ts).
 */
export const requestVerification = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await refuseOnReviewAccount(ctx, userId);
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) throw new ConvexError("Invalid email address");

    // Block re-verifying the same address. Add (no current email) and change
    // (current verified, but new value differs) flows are both allowed.
    const user = await ctx.db.get(userId);
    if (user?.emailVerificationTime && user.email === email) {
      throw new ConvexError("New email is the same as the current one.");
    }
    if (user?.emailVerificationTime) {
      await requireSessionProof(ctx, "phone", "vault");
    }
    await assertEmailAvailable(ctx, email, userId);

    const now = Date.now();
    const recent = await ctx.db
      .query("email_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gt(q.field("_creationTime"), now - RATE_LIMIT_WINDOW_MS))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new ConvexError("Too many verification attempts. Try again later.");
    }
    // Per destination too, across accounts: farmed accounts must not send a
    // stream of codes to someone else's address.
    await enforceIpRateLimit(
      ctx,
      "email_verification_to",
      email,
      RATE_LIMIT_MAX,
    );
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
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
      purpose: "verify_email",
      language: user?.language,
    });

    return { sent: true };
  },
});

/**
 * Validate the submitted code and, on success, either:
 *  - **Add flow** (no current verified email): link a fresh passwordless
 *    `email-otp` auth account and stamp `users.email` + verification time.
 *  - **Change flow** (already had a verified email): re-point this user's
 *    existing `password` / `email-otp` auth accounts at the new normalized
 *    address so the old email stops authenticating, then stamp `users.email`.
 *
 * Either way the mutation is atomic — any failure rolls back the whole tx —
 * and audited so the identifier rotation lands on the chain.
 */
export const verifyCodeAndLink = auditedMutation({
  action: "user.email.changed",
  resourceType: "user",
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const now = Date.now();
    const candidates = await ctx.db
      .query("email_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const check = await checkOtp(ctx, candidates, args.code);
    if ("wrong" in check) {
      return { verified: false as const, error: INVALID_CODE };
    }
    const { active } = check;

    const email = active.email;
    // Re-check at the security boundary (transactional): the address must
    // still be free and the user must not be re-confirming their current one.
    const user = await ctx.db.get(userId);
    const previousEmail = user?.email ?? null;
    if (user?.emailVerificationTime && previousEmail === email) {
      await ctx.db.delete(active._id);
      throw new ConvexError("New email is the same as the current one.");
    }
    await assertEmailAvailable(ctx, email, userId);

    if (user?.emailVerificationTime) {
      // Change flow: rotate the providerAccountId on every email-keyed auth
      // account this user owns so the old address stops being a valid login.
      // Defensive: re-check no other user already owns the new id on each
      // provider before patching.
      const ownedAccounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect();
      let hasEmailOtp = false;
      for (const acc of ownedAccounts) {
        if (acc.provider !== "password" && acc.provider !== "email-otp") {
          continue;
        }
        const clash = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", acc.provider).eq("providerAccountId", email),
          )
          .first();
        if (clash && clash._id !== acc._id) {
          await ctx.db.delete(active._id);
          throw new ConvexError(
            "This email is already linked to another account.",
          );
        }
        await ctx.db.patch(acc._id, {
          providerAccountId: email,
          ...(acc.emailVerified !== undefined ? { emailVerified: email } : {}),
        });
        if (acc.provider === "email-otp") hasEmailOtp = true;
      }
      // Password-only accounts gain a passwordless login method on first
      // change, mirroring the add flow's behaviour.
      if (!hasEmailOtp) {
        await ctx.db.insert("authAccounts", {
          userId,
          provider: "email-otp",
          providerAccountId: email,
          emailVerified: email,
        });
      }
    } else {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "email-otp",
        providerAccountId: email,
        emailVerified: email,
      });
    }

    await ctx.db.patch(userId, {
      email,
      emailVerificationTime: now,
      updatedAt: now,
    });
    await ctx.db.delete(active._id);

    return { verified: true as const, email, previousEmail };
  },
  // A wrong code is returned, not thrown, so its attempt is counted (see
  // lib/otp.ts); it changes nothing worth an audit entry.
  skipAudit: (result) => !result.verified,
  getMetadata: (_args, result) => ({
    previousEmail: result.previousEmail,
    newEmail: result.email,
  }),
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
