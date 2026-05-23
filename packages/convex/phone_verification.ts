import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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
 * Issue a fresh 6-digit OTP and dispatch it via WhatsApp. Optionally
 * updates the user's phone number first (same shape as updateProfile).
 * Rate-limited to 3 requests per rolling hour.
 */
export const requestVerification = mutation({
  args: {
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (args.phoneNumber !== undefined) {
      const next = normalizeE164(args.phoneNumber);
      const current = await ctx.db.get(userId);
      const patch: Record<string, unknown> = {
        phoneNumber: next,
        updatedAt: Date.now(),
      };
      if (current?.phoneNumber !== next) {
        patch.phoneNumberVerifiedAt = undefined;
      }
      await ctx.db.patch(userId, patch);
    }

    const user = await ctx.db.get(userId);
    if (!user?.phoneNumber) {
      throw new Error("Phone number is not set");
    }

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
      phoneNumber: user.phoneNumber,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
      phoneNumber: user.phoneNumber,
      code,
    });

    return { sent: true };
  },
});

/**
 * Validate the user-submitted OTP. On success: mark the user's phone as
 * verified and consume the code. On failure: bump attempts and throw.
 */
export const verifyCode = mutation({
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

    const user = await ctx.db.get(userId);
    if (user?.phoneNumber !== active.phoneNumber) {
      await ctx.db.delete(active._id);
      throw new Error("Phone number changed. Request a new code.");
    }

    const submittedHash = await sha256Hex(trimmed);
    if (submittedHash !== active.codeHash) {
      await ctx.db.patch(active._id, { attempts: active.attempts + 1 });
      throw new Error("Invalid code");
    }

    await ctx.db.patch(userId, {
      phoneNumberVerifiedAt: now,
      updatedAt: now,
    });

    // Link a passwordless `phone-otp` auth account if the user doesn't have one
    // (e.g. an email/password account adding a phone), so the verified number
    // becomes a login method — not just a notification channel. Pure phone
    // accounts already have one from signup, so this is a no-op for them.
    const existingPhoneOtp = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "phone-otp"),
      )
      .first();
    if (!existingPhoneOtp) {
      const clash = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "phone-otp").eq("providerAccountId", active.phoneNumber),
        )
        .first();
      if (clash && clash.userId !== userId) {
        throw new Error("This phone number is already linked to another account.");
      }
      if (!clash) {
        await ctx.db.insert("authAccounts", {
          userId,
          provider: "phone-otp",
          providerAccountId: active.phoneNumber,
          phoneVerified: active.phoneNumber,
        });
      }
    }

    await ctx.db.delete(active._id);

    return { verified: true };
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
      .query("phone_verification_codes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const pending = codes.find((c) => c.expiresAt > now);

    return {
      phoneNumber: user.phoneNumber ?? null,
      verifiedAt: user.phoneNumberVerifiedAt ?? null,
      hasPendingCode: !!pending,
      pendingExpiresAt: pending?.expiresAt ?? null,
    };
  },
});
