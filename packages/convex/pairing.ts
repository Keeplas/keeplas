import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  auditContextValidator,
  auditedMutation,
  verifyAuditContext,
} from "./audit";
import { requireAuth, requireFullAuth } from "./helpers";
import {
  base64ToBytes,
  constantTimeStringEquals,
  sha256Hex,
} from "./lib/crypto";
import { enforceIpRateLimit } from "./lib/rate_limit";

/**
 * QR pairing (v2 workflow 8): a signed-in phone links a new browser without a
 * password or the 24 words.
 *
 *   browser  create(eph pk, H(secret))            → waiting, QR = id + key hash
 *   phone    get → check key hash → approve(env)  → approved
 *   browser  signIn("pairing", secret)            → redeemLoginToken (≤ 60 s)
 *   browser  readEnvelope(secret)                 → consumed, envelope wiped
 *
 * Every row is purged at `expiresAt` (2 min), whatever its status.
 */

export const PAIRING_TTL_MS = 2 * 60 * 1000;
export const LOGIN_TOKEN_TTL_MS = 60 * 1000;
const CREATE_RATE_LIMIT_MAX = 20; // per IP per hour
const ML_KEM_768_PUBLIC_KEY_BYTES = 1184;
// The QR carries the first 16 bytes of SHA-256(eph pk), hex-encoded.
const KEY_HASH_HEX_LENGTH = 32;
const MAX_USER_AGENT_LENGTH = 512;
export const PAIRING_KEY_MISMATCH = "PAIRING_KEY_MISMATCH";
const INVALID_PAIRING = "Invalid or expired pairing";

/** Key hash shown in the QR: hex of the first 16 bytes of SHA-256(eph pk). */
export async function pairingKeyHash(browserPublicKey: string) {
  const digest = await sha256Hex(base64ToBytes(browserPublicKey));
  return digest.slice(0, KEY_HASH_HEX_LENGTH);
}

function isLive(session: Doc<"pairing_sessions"> | null, now: number) {
  return session !== null && session.expiresAt > now;
}

/** Browser: open a session for its ephemeral ML-KEM key. Unauthenticated. */
export const create = mutation({
  args: {
    browserPublicKey: v.string(),
    secretHash: v.string(),
    userAgent: v.string(),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "pairing_create",
      args._audit.ip,
      CREATE_RATE_LIMIT_MAX,
    );

    let keyBytes: Uint8Array;
    try {
      keyBytes = base64ToBytes(args.browserPublicKey);
    } catch {
      throw new ConvexError("Invalid public key");
    }
    if (keyBytes.length !== ML_KEM_768_PUBLIC_KEY_BYTES) {
      throw new ConvexError("Invalid public key");
    }
    if (!/^[0-9a-f]{64}$/.test(args.secretHash)) {
      throw new ConvexError("Invalid secret hash");
    }

    const now = Date.now();
    const expiresAt = now + PAIRING_TTL_MS;
    const sessionId = await ctx.db.insert("pairing_sessions", {
      browserPublicKey: args.browserPublicKey,
      secretHash: args.secretHash,
      userAgent: args.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
      approxLocation: args._audit.country,
      status: "waiting",
      expiresAt,
      createdAt: now,
    });
    await ctx.scheduler.runAt(expiresAt, internal.pairing.purge, {
      sessionId,
    });
    return { sessionId, expiresAt };
  },
});

/**
 * Browser: live status for W04-2. Exposes nothing else, so a shoulder-surfed
 * QR (it carries the session id) leaks no token or envelope.
 */
export const status = query({
  args: { sessionId: v.id("pairing_sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || !isLive(session, Date.now())) return "expired" as const;
    return session.status;
  },
});

/** Phone: details for M03-5. The app checks the key hash before approving. */
export const get = query({
  args: { sessionId: v.id("pairing_sessions") },
  handler: async (ctx, args) => {
    await requireFullAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || !isLive(session, Date.now())) return null;
    if (session.status !== "waiting") return null;
    return {
      browserPublicKey: session.browserPublicKey,
      userAgent: session.userAgent,
      approxLocation: session.approxLocation,
      expiresAt: session.expiresAt,
    };
  },
});

/**
 * Phone: approve with the MasterKey envelope sealed to the browser key.
 * `keyHash` is the value read from the QR; a mismatch means the stored key
 * is not the one the browser displayed, so the approval is refused.
 */
export const approve = auditedMutation({
  action: "pairing.session.approved",
  resourceType: "pairing_session",
  args: {
    sessionId: v.id("pairing_sessions"),
    keyHash: v.string(),
    envelope: v.string(),
    approvalSignature: v.string(),
  },
  getResourceId: (args) => args.sessionId,
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || !isLive(session, Date.now())) {
      throw new ConvexError(INVALID_PAIRING);
    }
    if (session.status !== "waiting") throw new ConvexError(INVALID_PAIRING);

    const expected = await pairingKeyHash(session.browserPublicKey);
    if (!constantTimeStringEquals(expected, args.keyHash)) {
      throw new ConvexError(PAIRING_KEY_MISMATCH);
    }

    await ctx.db.patch(args.sessionId, {
      status: "approved",
      userId,
      envelope: args.envelope,
      approvalSignature: args.approvalSignature,
      approvedAt: Date.now(),
    });
  },
});

/** Phone: decline the link, or report a key-hash mismatch (M09-3). */
export const reject = auditedMutation({
  action: "pairing.session.rejected",
  resourceType: "pairing_session",
  args: {
    sessionId: v.id("pairing_sessions"),
    reason: v.union(v.literal("declined"), v.literal("key_mismatch")),
  },
  getResourceId: (args) => args.sessionId,
  getMetadata: (args) => ({ reason: args.reason }),
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || !isLive(session, Date.now())) return;
    if (session.status !== "waiting") return;
    await ctx.db.patch(args.sessionId, { status: "rejected", userId });
  },
});

/** Shared check: the caller holds the login secret of an approved session. */
async function requireSecret(session: Doc<"pairing_sessions">, secret: string) {
  const hash = await sha256Hex(secret);
  if (!constantTimeStringEquals(hash, session.secretHash)) {
    throw new ConvexError(INVALID_PAIRING);
  }
}

/**
 * Consumed by the `pairing` auth provider (auth.ts). Single use, valid 60 s
 * after approval and never past the session expiry. Returns the approver.
 */
export const redeemLoginToken = internalMutation({
  args: { sessionId: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("pairing_sessions", args.sessionId);
    const session = id ? await ctx.db.get(id) : null;
    const now = Date.now();
    if (
      !session ||
      !isLive(session, now) ||
      session.status !== "approved" ||
      session.redeemedAt !== undefined ||
      !session.userId ||
      !session.approvedAt ||
      now > session.approvedAt + LOGIN_TOKEN_TTL_MS
    ) {
      throw new ConvexError(INVALID_PAIRING);
    }
    await requireSecret(session, args.secret);
    await ctx.db.patch(session._id, { redeemedAt: now });
    return session.userId;
  },
});

/**
 * Browser, once signed in: read the envelope exactly once. The row is wiped
 * of ciphertext and marked consumed in the same transaction.
 */
async function consumeEnvelope(
  ctx: MutationCtx,
  args: { sessionId: Id<"pairing_sessions">; secret: string },
  requireRedeemed: boolean,
) {
  const userId = await requireAuth(ctx);
  const session = await ctx.db.get(args.sessionId);
  if (
    !session ||
    !isLive(session, Date.now()) ||
    session.status !== "approved" ||
    (requireRedeemed && session.redeemedAt === undefined) ||
    session.userId !== userId ||
    !session.envelope ||
    !session.approvalSignature
  ) {
    throw new ConvexError(INVALID_PAIRING);
  }
  await requireSecret(session, args.secret);
  await ctx.db.patch(args.sessionId, {
    status: "consumed",
    envelope: undefined,
    approvalSignature: undefined,
  });
  return {
    envelope: session.envelope,
    approvalSignature: session.approvalSignature,
  };
}

export const readEnvelope = auditedMutation({
  action: "pairing.session.consumed",
  resourceType: "pairing_session",
  args: { sessionId: v.id("pairing_sessions"), secret: v.string() },
  getResourceId: (args) => args.sessionId,
  handler: (ctx, args) => consumeEnvelope(ctx, args, true),
});

export const claimEnvelope = auditedMutation({
  action: "pairing.session.consumed",
  resourceType: "pairing_session",
  args: { sessionId: v.id("pairing_sessions"), secret: v.string() },
  getResourceId: (args) => args.sessionId,
  handler: (ctx, args) => consumeEnvelope(ctx, args, false),
});

/** Scheduled at creation for `expiresAt`: drop the row, whatever its state. */
export const purge = internalMutation({
  args: { sessionId: v.id("pairing_sessions") },
  handler: async (ctx, args) => {
    if (await ctx.db.get(args.sessionId)) {
      await ctx.db.delete(args.sessionId);
    }
  },
});
