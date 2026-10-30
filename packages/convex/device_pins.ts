import { ConvexError, v } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { auditedMutation } from "./audit";
import { requireAuth } from "./helpers";
import { constantTimeStringEquals, sha256Hex } from "./lib/crypto";

/**
 * Server half of the web device PIN (apps/web/src/lib/device-unlock/pin.ts).
 *
 * A 4-digit PIN has 10^4 values: a MasterKey wrapped under the PIN alone
 * falls to an offline search in minutes from a copied browser profile. The
 * browser therefore wraps it under HKDF(Argon2id(PIN, deviceSalt), secret),
 * where `secret` is random, kept here, and released only
 *  - to the session that saved the PIN: the row ends with that session, so
 *    a profile copied after sign-out or device removal opens nothing;
 *  - after a correct PIN proof, counted here: PIN_WIPE_THRESHOLD wrong ones
 *    delete the row, and with it every way to open the wrap.
 * Zero-knowledge holds: the server sees the secret and a hash of the proof,
 * never the deviceSalt or the wrapped key, so it cannot even test PINs.
 */

export const PIN_LOCKOUT_THRESHOLD = 5;
export const PIN_LOCKOUT_MS = 60_000;
export const PIN_WIPE_THRESHOLD = 10;
const MAX_PINS_PER_SESSION = 5;

/** 32 bytes in standard base64. */
const KEY_BYTES_B64 = /^[A-Za-z0-9+/]{43}=$/;

export type PinReleaseResult =
  | { status: "ok"; secret: string; trusted: boolean }
  | { status: "wrong"; failCount: number; maxAttempts: number }
  | { status: "locked"; retryAfterMs: number }
  | { status: "wiped" }
  | { status: "gone" };

async function requireSession(ctx: MutationCtx) {
  const userId = await requireAuth(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new ConvexError("No session");
  return { userId, sessionId };
}

/**
 * Whether the browser on this session was linked with "Keep me logged in".
 * No device record (or a revoked one) counts as not trusted.
 */
async function isTrustedBrowser(
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
): Promise<boolean> {
  const devices = await ctx.db
    .query("devices")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);
  return devices.some(
    (device) =>
      device.sessionId === sessionId &&
      device.revokedAt === undefined &&
      device.trusted,
  );
}

/** Save the server half of a new PIN for this browser session. */
export const enroll = auditedMutation({
  action: "device_pin.enrolled",
  resourceType: "device_pin",
  args: { pinProof: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    const { userId, sessionId } = await requireSession(ctx);
    if (!KEY_BYTES_B64.test(args.pinProof) || !KEY_BYTES_B64.test(args.secret)) {
      throw new ConvexError("Invalid PIN material");
    }
    // Rows of ended sessions can never be released again: drop them here
    // rather than in a cron.
    const rows = await ctx.db
      .query("device_pins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    let inSession = 0;
    for (const row of rows) {
      if (row.sessionId === sessionId) inSession++;
      else if ((await ctx.db.get(row.sessionId)) === null) {
        await ctx.db.delete(row._id);
      }
    }
    if (inSession >= MAX_PINS_PER_SESSION) {
      throw new ConvexError("Too many PINs on this browser");
    }
    const pinId = await ctx.db.insert("device_pins", {
      userId,
      sessionId,
      proofHash: await sha256Hex(args.pinProof),
      secret: args.secret,
      failCount: 0,
      createdAt: Date.now(),
    });
    return {
      pinId,
      trusted: await isTrustedBrowser(ctx, userId, sessionId),
    };
  },
  getResourceId: (_args, result) => result.pinId,
});

/**
 * Hand the secret back for a correct PIN proof. A wrong one is counted and
 * returned, never thrown (a throw would roll the count back).
 */
export const release = auditedMutation({
  action: "device_pin.unlocked",
  resourceType: "device_pin",
  args: { pinId: v.id("device_pins"), pinProof: v.string() },
  handler: async (ctx, args): Promise<PinReleaseResult> => {
    const { userId, sessionId } = await requireSession(ctx);
    const row = await ctx.db.get(args.pinId);
    if (!row || row.userId !== userId || row.sessionId !== sessionId) {
      return { status: "gone" };
    }
    const now = Date.now();
    if (row.lockedUntil !== undefined && row.lockedUntil > now) {
      return { status: "locked", retryAfterMs: row.lockedUntil - now };
    }
    if (constantTimeStringEquals(row.proofHash, await sha256Hex(args.pinProof))) {
      if (row.failCount > 0 || row.lockedUntil !== undefined) {
        await ctx.db.patch(row._id, { failCount: 0, lockedUntil: undefined });
      }
      return {
        status: "ok",
        secret: row.secret,
        trusted: await isTrustedBrowser(ctx, userId, sessionId),
      };
    }
    const failCount = row.failCount + 1;
    if (failCount >= PIN_WIPE_THRESHOLD) {
      await ctx.db.delete(row._id);
      return { status: "wiped" };
    }
    if (failCount >= PIN_LOCKOUT_THRESHOLD) {
      await ctx.db.patch(row._id, {
        failCount,
        lockedUntil: now + PIN_LOCKOUT_MS,
      });
      return { status: "locked", retryAfterMs: PIN_LOCKOUT_MS };
    }
    await ctx.db.patch(row._id, { failCount });
    return { status: "wrong", failCount, maxAttempts: PIN_WIPE_THRESHOLD };
  },
  getResourceId: (args) => args.pinId,
  // Failed attempts are counted on the row, not audited (as with a wrong TOTP
  // code). Unlocks are.
  skipAudit: (result) => result.status !== "ok",
});

/** Forget a PIN removed from this browser (Devices page). */
export const remove = auditedMutation({
  action: "device_pin.removed",
  resourceType: "device_pin",
  args: { pinId: v.id("device_pins") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(args.pinId);
    if (row?.userId === userId) await ctx.db.delete(row._id);
    return null;
  },
  getResourceId: (args) => args.pinId,
});
