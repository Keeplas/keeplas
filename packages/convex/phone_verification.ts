import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { requireAuth, requireFullAuth } from "./helpers";
import {
  grantCurrentSessionProof,
  requireSessionProof,
} from "./session_proofs";
import { normalizeE164 } from "./lib/phone";
import { sha256Hex } from "./lib/crypto";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

/**
 * Issue a fresh 6-digit OTP and dispatch it via WhatsApp. `phoneNumber` is the
 * destination to verify — required for both add and change flows. It is NEVER
 * written to `users` here; the pending value lives on the code row until
 * verifyCode commits it, mirroring how email_verification stages the email on
 * the code row. Rate-limited to 3 requests per rolling hour. Refuses if the
 * number is identical to the user's current verified one.
 *
 * The number becomes a login method, so the session must clear every step-up
 * gate first (a password alone must not add one). Replacing a verified
 * number also needs this session to have proved the current one or opened
 * the vault (session_proofs.ts): otherwise a synced passkey could swap in a
 * new number and pass for its owner on WhatsApp.
 */
export const requestVerification = mutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new Error("A valid phone number is required");

    const user = await ctx.db.get(userId);
    if (user?.phoneNumberVerifiedAt && user.phoneNumber === phone) {
      throw new Error("New phone number is the same as the current one.");
    }
    if (user?.phoneNumberVerifiedAt) {
      await requireSessionProof(ctx, "phone", "vault");
    }
    await assertPhoneAvailable(ctx, phone, userId);

    const now = Date.now();
    const recent = await ctx.db
      .query("phone_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gt(q.field("_creationTime"), now - RATE_LIMIT_WINDOW_MS))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new Error("Too many verification attempts. Try again later.");
    }

    for (const stale of recent) {
      if (stale.expiresAt > now) {
        await ctx.db.patch(stale._id, { expiresAt: now });
      }
    }

    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    await ctx.db.insert("phone_verification_codes", {
      userId,
      phoneNumber: phone,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
      phoneNumber: phone,
      code,
      language: user?.language,
    });

    return { sent: true };
  },
});

/**
 * Reject if `phone` is already used by another user. Mirrors the email-side
 * `assertEmailAvailable` check. Defense-in-depth: enforced again at verify
 * time (against the `phone-otp` auth account index).
 */
export async function assertPhoneAvailable(
  ctx: QueryCtx,
  phone: string,
  userId: Id<"users">,
): Promise<void> {
  if (await phoneTakenByOther(ctx, phone, userId)) {
    throw new Error("This phone number is already linked to another account.");
  }
}

/** Whether another account than `userId` holds `phone`. */
export async function phoneTakenByOther(
  ctx: QueryCtx,
  phone: string,
  userId: Id<"users">,
): Promise<boolean> {
  const owner = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
    .first();
  return owner !== null && owner._id !== userId;
}

/**
 * Make `newPhone` the account's verified number and rotate or create the
 * `phone-otp` auth account so it is the only valid one for password-less
 * phone login. Returns the previous number. Throws when another account
 * holds `newPhone` (re-checked at the security boundary: it could have been
 * grabbed since the code was sent).
 */
export async function commitPhoneChange(
  ctx: MutationCtx,
  userId: Id<"users">,
  newPhone: string,
): Promise<string | null> {
  await assertPhoneAvailable(ctx, newPhone, userId);
  const existingPhoneOtp = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "phone-otp"),
    )
    .first();
  const clash = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "phone-otp").eq("providerAccountId", newPhone),
    )
    .first();
  if (clash && clash.userId !== userId) {
    throw new Error("This phone number is already linked to another account.");
  }
  if (existingPhoneOtp) {
    if (existingPhoneOtp.providerAccountId !== newPhone) {
      await ctx.db.patch(existingPhoneOtp._id, {
        providerAccountId: newPhone,
        phoneVerified: newPhone,
      });
    }
  } else if (!clash) {
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "phone-otp",
      providerAccountId: newPhone,
      phoneVerified: newPhone,
    });
  }
  const user = await ctx.db.get(userId);
  const now = Date.now();
  await ctx.db.patch(userId, {
    phoneNumber: newPhone,
    phoneNumberVerifiedAt: now,
    updatedAt: now,
  });
  return user?.phoneNumber ?? null;
}

/**
 * Validate the user-submitted OTP. On success commit the staged phone number
 * to `users.phoneNumber`, mark it verified, and either:
 *  - **Add flow** (no `phone-otp` auth account yet): insert one keyed on the
 *    new number so it becomes a login method.
 *  - **Change flow** (existing `phone-otp` account keyed on the OLD number):
 *    patch its `providerAccountId` to the new number so the old one stops
 *    authenticating.
 * Atomic + audited.
 */
export const verifyCode = auditedMutation({
  action: "user.phone.changed",
  resourceType: "user",
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const candidates = await ctx.db
      .query("phone_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const check = await checkOtp(ctx, candidates, args.code);
    if ("wrong" in check) {
      return { verified: false as const, error: INVALID_CODE };
    }
    const { active } = check;

    const newPhone = active.phoneNumber;
    const previousPhone = await commitPhoneChange(ctx, userId, newPhone);
    await ctx.db.delete(active._id);
    await grantCurrentSessionProof(ctx, userId, "phone");

    return { verified: true as const, phoneNumber: newPhone, previousPhone };
  },
  // A wrong code is returned, not thrown, so its attempt is counted (see
  // lib/otp.ts); it changes nothing worth an audit entry.
  skipAudit: (result) => !result.verified,
  getMetadata: (_args, result) => ({
    previousPhone: result.previousPhone,
    newPhone: result.phoneNumber,
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
      .query("phone_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const pending = codes.find((c) => c.expiresAt > now);

    return {
      phoneNumber: user.phoneNumber ?? null,
      verifiedAt: user.phoneNumberVerifiedAt ?? null,
      hasPendingCode: !!pending,
      pendingPhone: pending?.phoneNumber ?? null,
      pendingExpiresAt: pending?.expiresAt ?? null,
    };
  },
});
