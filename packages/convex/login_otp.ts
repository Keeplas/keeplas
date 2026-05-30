import { v } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { constantTimeStringEquals } from "./lib/crypto";
import { hasPasswordAccount, optionalAuth, requireAuth } from "./helpers";

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

type Channel = "email" | "whatsapp";

/**
 * Pick the OTP channel from the account's identifier: email accounts get an
 * emailed code, phone accounts a WhatsApp code. Passkey-only accounts with
 * neither have no channel (the recovery phrase is their escape hatch).
 */
function resolveChannel(
  user: Doc<"users">,
): { channel: Channel; destination: string } | null {
  if (user.email) return { channel: "email", destination: user.email };
  if (user.phoneNumber)
    return { channel: "whatsapp", destination: user.phoneNumber };
  return null;
}

function maskDestination(channel: Channel, destination: string): string {
  if (channel === "email") {
    const [local, domain] = destination.split("@");
    if (!domain) return "•••";
    const head = local.slice(0, 1);
    return `${head}•••@${domain}`;
  }
  // E.164 phone: keep country-ish prefix + last 2 digits.
  return `${destination.slice(0, 3)}•••${destination.slice(-2)}`;
}

/**
 * Gate state for the current Convex Auth session: tells the dashboard
 * layout whether to redirect to /login/otp. Login OTP is ALWAYS required
 * (no enrollment check, unlike TOTP) — a session is cleared only by an
 * explicit code submission, recovery, or the post-signup credit.
 */
export const getMyLoginOtpGate = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) {
      return {
        authenticated: false,
        required: false,
        channelMasked: null as string | null,
        recoveryBound: false,
        phraseSalt: null as string | null,
      };
    }
    const user = await ctx.db.get(userId);
    const recoveryBound = !!user?.recoveryPhraseHash;
    // Non-sensitive per-user salt — needed client-side to derive the salted
    // recovery-phrase verifier. Only exposed to the authenticated owner.
    const phraseSalt = user?.phraseSalt ?? null;
    const resolved = user ? resolveChannel(user) : null;
    const channelMasked = resolved
      ? maskDestination(resolved.channel, resolved.destination)
      : null;

    // Passwordless accounts (phone-otp / email-otp) already did an OTP at
    // sign-in — don't double-prompt them. The gate applies only to accounts
    // that have a password.
    if (!(await hasPasswordAccount(ctx, userId))) {
      return {
        authenticated: true,
        required: false,
        channelMasked,
        recoveryBound,
        phraseSalt,
      };
    }

    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) {
      return {
        authenticated: true,
        required: true,
        channelMasked,
        recoveryBound,
        phraseSalt,
      };
    }
    const cleared = await ctx.db
      .query("auth_session_login_otp")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    return {
      authenticated: true,
      required: !cleared,
      channelMasked,
      recoveryBound,
      phraseSalt,
    };
  },
});

/**
 * Issue + dispatch a fresh login OTP on the account's channel. No-op when
 * the session is already cleared. Rate-limited to 3 per rolling hour.
 */
export const requestLoginOtp = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");

    const alreadyCleared = await ctx.db
      .query("auth_session_login_otp")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (alreadyCleared) return { sent: false, alreadyCleared: true };

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    const resolved = resolveChannel(user);
    if (!resolved) throw new Error("No verification channel available");

    const now = Date.now();
    const recent = await ctx.db
      .query("login_otp_codes")
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
    await ctx.db.insert("login_otp_codes", {
      userId,
      channel: resolved.channel,
      destination: resolved.destination,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });

    if (resolved.channel === "whatsapp") {
      await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
        phoneNumber: resolved.destination,
        code,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.dispatch.sendEmailOtp, {
        email: resolved.destination,
        code,
      });
    }

    return { sent: true, channel: resolved.channel };
  },
});

/**
 * Verify the submitted login OTP for the current session and mark the
 * session as having cleared the step. Mirrors phone_verification.verifyCode
 * + the TOTP session-credit pattern.
 */
export const submitLoginOtpForSession = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireAuth(ctx);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("Code must be 6 digits");
    }
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");

    const now = Date.now();
    const candidates = await ctx.db
      .query("login_otp_codes")
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

    const user = await ctx.db.get(userId);
    const resolved = user ? resolveChannel(user) : null;
    if (!resolved || resolved.destination !== active.destination) {
      await ctx.db.delete(active._id);
      throw new Error("Account channel changed. Request a new code.");
    }

    const submittedHash = await sha256Hex(trimmed);
    if (submittedHash !== active.codeHash) {
      await ctx.db.patch(active._id, { attempts: active.attempts + 1 });
      throw new Error("Invalid code");
    }

    await ctx.db.delete(active._id);

    const existing = await ctx.db
      .query("auth_session_login_otp")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!existing) {
      await ctx.db.insert("auth_session_login_otp", {
        sessionId,
        userId,
        verifiedAt: now,
      });
    }
    if (active.channel === "whatsapp") {
      await ctx.db.patch(userId, {
        phoneNumberVerifiedAt: now,
        updatedAt: now,
      });
    }
    return { success: true };
  },
});

/**
 * Recovery-phrase escape hatch (24-word verifier hash). On match, credits
 * the current session so the dashboard unlocks without a channel code —
 * the only way through when no channel is available. ZK: this only compares
 * a stored hash; no crypto is touched.
 */
export const submitLoginOtpRecovery = mutation({
  args: { verifierHash: v.string() },
  handler: async (ctx, { verifierHash }) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user || !user.recoveryPhraseHash) {
      throw new Error("Recovery via seed is not configured for this account.");
    }
    if (!constantTimeStringEquals(user.recoveryPhraseHash, verifierHash)) {
      throw new Error("Recovery phrase did not match. Try again.");
    }

    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");
    const now = Date.now();
    const existing = await ctx.db
      .query("auth_session_login_otp")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!existing) {
      await ctx.db.insert("auth_session_login_otp", {
        sessionId,
        userId,
        verifiedAt: now,
      });
    }
    return { success: true };
  },
});

/**
 * Credit the current session immediately after signup verification — the
 * signup flow already proved channel ownership via its own OTP, so we don't
 * double-prompt. Guarded: only honored when the account's channel was
 * verified within the OTP window (prevents reuse to bypass login OTP later).
 */
export const creditSignupSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const verifiedRecently =
      (user.emailVerificationTime !== undefined &&
        now - user.emailVerificationTime < OTP_TTL_MS) ||
      (user.phoneNumberVerifiedAt !== undefined &&
        now - user.phoneNumberVerifiedAt < OTP_TTL_MS);
    if (!verifiedRecently) return { credited: false };

    const existing = await ctx.db
      .query("auth_session_login_otp")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!existing) {
      await ctx.db.insert("auth_session_login_otp", {
        sessionId,
        userId,
        verifiedAt: now,
      });
    }
    return { credited: true };
  },
});
