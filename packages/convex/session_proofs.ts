import { v, ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { optionalAuth, requireAuth } from "./helpers";
import { sha256Hex } from "./lib/crypto";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";
import { maskPhone } from "./lib/phone";

/**
 * What a session has proven beyond its sign-in. A synced passkey or a
 * stolen iCloud account opens a session, but restoring the cloud backup or
 * asking contacts to recover the vault also needs a WhatsApp code that
 * reached the account's number in this session ("phone").
 */

export type SessionProof = "phone";

export const PHONE_PROOF_REQUIRED = "PHONE_PROOF_REQUIRED";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
// Convex Auth's default (implementation/sessions.ts): sessions we open for
// the phone-otp provider must live exactly as long as the ones it opens.
const DEFAULT_SESSION_TOTAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

async function sessionHas(
  ctx: QueryCtx,
  sessionId: Id<"authSessions">,
  kind: SessionProof,
): Promise<boolean> {
  const rows = await ctx.db
    .query("auth_session_proofs")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return rows.some((row) => row.kind === kind);
}

/** Record that `sessionId` proved `kind` (idempotent). */
export async function grantSessionProof(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"authSessions">;
    userId: Id<"users">;
    kind: SessionProof;
  },
): Promise<void> {
  if (await sessionHas(ctx, args.sessionId, args.kind)) return;
  await ctx.db.insert("auth_session_proofs", {
    ...args,
    verifiedAt: Date.now(),
  });
}

/** Grant `kind` to the caller's session, if it has one. */
export async function grantCurrentSessionProof(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: SessionProof,
): Promise<void> {
  const sessionId = await getAuthSessionId(ctx);
  if (sessionId) await grantSessionProof(ctx, { sessionId, userId, kind });
}

/** Throws `PHONE_PROOF_REQUIRED` unless this session proved the number. */
export async function requirePhoneProof(ctx: QueryCtx): Promise<void> {
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId || !(await sessionHas(ctx, sessionId, "phone"))) {
    throw new ConvexError(PHONE_PROOF_REQUIRED);
  }
}

/**
 * Open the session the `phone-otp` provider signs in with, already holding
 * the "phone" proof: its code just reached the number (auth.ts).
 */
export const openPhoneProvenSession = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime:
        Date.now() +
        (Number(process.env.AUTH_SESSION_TOTAL_DURATION_MS) ||
          DEFAULT_SESSION_TOTAL_DURATION_MS),
    });
    await grantSessionProof(ctx, { sessionId, userId, kind: "phone" });
    return sessionId;
  },
});

/** The caller's proofs, and the number an in-session code would go to. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const sessionId = await getAuthSessionId(ctx);
    return {
      phone: !!sessionId && (await sessionHas(ctx, sessionId, "phone")),
      phoneMasked: user?.phoneNumber ? maskPhone(user.phoneNumber) : null,
    };
  },
});

/** Send a WhatsApp code to the account's number for this session. */
export const requestPhoneCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");
    const user = await ctx.db.get(userId);
    if (!user?.phoneNumber) throw new ConvexError("NO_PHONE_NUMBER");

    const now = Date.now();
    const recent = (
      await ctx.db
        .query("session_phone_codes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((c) => c._creationTime > now - RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new ConvexError("Too many verification attempts. Try again later.");
    }
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
    }

    const code = generateOtp();
    await ctx.db.insert("session_phone_codes", {
      userId,
      sessionId,
      phoneNumber: user.phoneNumber,
      codeHash: await sha256Hex(code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
      phoneNumber: user.phoneNumber,
      code,
      language: user.language,
    });
    return { sent: true };
  },
});

/** Check the in-session code; on success the session proves the number. */
export const verifyPhoneCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireAuth(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");
    const candidates = (
      await ctx.db
        .query("session_phone_codes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).filter((c) => c.sessionId === sessionId);
    const check = await checkOtp(ctx, candidates, code);
    if ("wrong" in check)
      return { success: false as const, error: INVALID_CODE };

    const user = await ctx.db.get(userId);
    if (user?.phoneNumber !== check.active.phoneNumber) {
      throw new ConvexError("Account number changed. Request a new code.");
    }
    await ctx.db.delete(check.active._id);
    await grantSessionProof(ctx, { sessionId, userId, kind: "phone" });
    return { success: true as const };
  },
});
