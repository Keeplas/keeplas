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
import { optionalAuth, requireAuth, requireFullAuth } from "./helpers";
import { sha256Hex } from "./lib/crypto";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";
import { maskPhone } from "./lib/phone";

/**
 * What a session has proven beyond its sign-in. A synced passkey or a
 * stolen iCloud account opens a session, but restoring the cloud backup or
 * asking contacts to recover the vault also needs a WhatsApp code that
 * reached the account's number in this session ("phone"). Resetting TOTP
 * or changing the number needs the vault opened in this session ("vault",
 * the ML-DSA identity key signs a nonce) or, for the number, the old one.
 */

export type SessionProof = "phone" | "vault";

const VAULT_CHALLENGE_TTL_MS = 5 * 60 * 1000;

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

/**
 * Throws unless this session proved one of `kinds`: `PHONE_PROOF_REQUIRED`
 * / `VAULT_PROOF_REQUIRED` for a single kind, `PROOF_REQUIRED` otherwise.
 */
export async function requireSessionProof(
  ctx: QueryCtx,
  ...kinds: SessionProof[]
): Promise<void> {
  const sessionId = await getAuthSessionId(ctx);
  for (const kind of kinds) {
    if (sessionId && (await sessionHas(ctx, sessionId, kind))) return;
  }
  throw new ConvexError(
    kinds.length === 1
      ? `${kinds[0].toUpperCase()}_PROOF_REQUIRED`
      : "PROOF_REQUIRED",
  );
}

/**
 * Replacing what proves the account's owner (recovery verifier, key bundle,
 * key material): every step-up gate, plus a "phone" or "vault" proof from
 * this session. A password or a synced passkey alone can pass
 * `requireFullAuth`; neither proves the number nor opens the vault.
 */
export async function requireProvenFullAuth(
  ctx: QueryCtx,
): Promise<Id<"users">> {
  const userId = await requireFullAuth(ctx);
  await requireSessionProof(ctx, "phone", "vault");
  return userId;
}

/**
 * Open the session a credentials provider signs in with, already holding
 * `kind` (auth.ts): "phone" when its WhatsApp code just reached the number,
 * "vault" when the 24-word verifier just matched.
 */
export const openProvenSession = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("phone"), v.literal("vault")),
  },
  handler: async (ctx, { userId, kind }) => {
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime:
        Date.now() +
        (Number(process.env.AUTH_SESSION_TOTAL_DURATION_MS) ||
          DEFAULT_SESSION_TOTAL_DURATION_MS),
    });
    await grantSessionProof(ctx, { sessionId, userId, kind });
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
      vault: !!sessionId && (await sessionHas(ctx, sessionId, "vault")),
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

/**
 * Nonce for the identity key to sign (single use, 5 minutes). The signature
 * is checked in `session_proofs_node.proveVault`: ML-DSA lives in
 * @keeplas/crypto, which only Node actions may import.
 */
export const startVaultProof = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) throw new Error("No active session.");
    const old = await ctx.db
      .query("session_vault_challenges")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    const nonce = crypto.randomUUID();
    await ctx.db.insert("session_vault_challenges", {
      sessionId,
      userId,
      nonce,
      expiresAt: Date.now() + VAULT_CHALLENGE_TTL_MS,
    });
    return { nonce };
  },
});

/**
 * Spend this session's nonce for `session_proofs_node.proveVault` (single
 * use, whatever the outcome) and return what the signature is checked
 * against; null when there is nothing valid to check.
 */
export const takeVaultChallenge = internalMutation({
  args: { sessionId: v.id("authSessions"), userId: v.id("users") },
  handler: async (ctx, { sessionId, userId }) => {
    const challenge = await ctx.db
      .query("session_vault_challenges")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!challenge) return null;
    await ctx.db.delete(challenge._id);
    const session = await ctx.db.get(sessionId);
    const user = await ctx.db.get(userId);
    if (
      challenge.userId !== userId ||
      challenge.expiresAt <= Date.now() ||
      session?.userId !== userId ||
      !user?.identityPublicKey
    ) {
      return null;
    }
    return {
      identityPublicKey: user.identityPublicKey,
      nonce: challenge.nonce,
    };
  },
});

/** A valid identity signature was checked: the session opened the vault. */
export const grantVaultProof = internalMutation({
  args: { sessionId: v.id("authSessions"), userId: v.id("users") },
  handler: (ctx, args) => grantSessionProof(ctx, { ...args, kind: "vault" }),
});
