import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { requireAuth } from "./helpers";
import { normalizeE164 } from "./lib/phone";

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
 * Issue a fresh 6-digit OTP and dispatch it via WhatsApp. `phoneNumber` is the
 * destination to verify — required for both add and change flows. It is NEVER
 * written to `users` here; the pending value lives on the code row until
 * verifyCode commits it, mirroring how email_verification stages the email on
 * the code row. Rate-limited to 3 requests per rolling hour. Refuses if the
 * number is identical to the user's current verified one.
 */
export const requestVerification = mutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new Error("A valid phone number is required");

    const user = await ctx.db.get(userId);
    if (user?.phoneNumberVerifiedAt && user.phoneNumber === phone) {
      throw new Error("New phone number is the same as the current one.");
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
        await ctx.db.delete(stale._id);
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
    });

    return { sent: true };
  },
});

/**
 * Reject if `phone` is already used by another user. Mirrors the email-side
 * `assertEmailAvailable` check. Defense-in-depth: enforced again at verify
 * time (against the `phone-otp` auth account index).
 */
async function assertPhoneAvailable(
  ctx: QueryCtx,
  phone: string,
  userId: Id<"users">,
): Promise<void> {
  const owner = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
    .first();
  if (owner && owner._id !== userId) {
    throw new Error("This phone number is already linked to another account.");
  }
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
    const userId = await requireAuth(ctx);
    const trimmed = args.code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("Code must be 6 digits");
    }

    const now = Date.now();
    const candidates = await ctx.db
      .query("phone_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = candidates
      .filter((c) => c.expiresAt > now)
      .sort((a, b) => b._creationTime - a._creationTime)[0];

    if (!active) {
      throw new Error("Code expired or not requested");
    }

    if (active.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(active._id);
      throw new Error("Too many attempts. Request a new code.");
    }

    const submittedHash = await sha256Hex(trimmed);
    if (submittedHash !== active.codeHash) {
      await ctx.db.patch(active._id, { attempts: active.attempts + 1 });
      throw new Error("Invalid code");
    }

    const newPhone = active.phoneNumber;
    const user = await ctx.db.get(userId);
    const previousPhone = user?.phoneNumber ?? null;

    // Re-check at the security boundary: another account could have grabbed
    // this number in the interval between request and verify.
    await assertPhoneAvailable(ctx, newPhone, userId);

    // Rotate or create the `phone-otp` auth account so the new number is the
    // only valid one for password-less phone login. Clash check covers the
    // case where another user owns the `phone-otp` row for `newPhone`.
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
      await ctx.db.delete(active._id);
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

    await ctx.db.patch(userId, {
      phoneNumber: newPhone,
      phoneNumberVerifiedAt: now,
      updatedAt: now,
    });
    await ctx.db.delete(active._id);

    return { verified: true, phoneNumber: newPhone, previousPhone };
  },
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
