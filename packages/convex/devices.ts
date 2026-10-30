import { v, ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { auditedMutation } from "./audit";
import { optionalAuth, requireAuth, requireFullAuth } from "./helpers";
import { constantTimeStringEquals, sha256Hex } from "./lib/crypto";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { endSession, endSessions } from "./lib/sessions";
import { cancelActiveRecovery } from "./recovery";

const MAX_LABEL_LENGTH = 100;
// Every device after the first alerts the owner (push, email, WhatsApp).
// Each device registers once, so this only stops a registration loop.
const REGISTRATIONS_PER_HOUR = 10;

/**
 * Record the current device after sign-up or a QR link (workflow 8, step 16).
 * Every device but the first raises a new-device alert (M08-4) on the others.
 * A phone signing in again passes the token it kept from `signOut`: it takes
 * its row back, with no alert. Any other token registers a new device, so
 * knowing a row id never silences the alert.
 */
export const register = auditedMutation({
  action: "device.registered",
  resourceType: "device",
  args: {
    kind: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    label: v.string(),
    devicePublicKey: v.optional(v.string()),
    trusted: v.boolean(),
    reattach: v.optional(
      v.object({ deviceId: v.id("devices"), token: v.string() }),
    ),
  },
  handler: async (ctx, args, audit) => {
    const userId = await requireAuth(ctx);
    await enforceIpRateLimit(
      ctx,
      "device_register",
      userId,
      REGISTRATIONS_PER_HOUR,
    );
    const now = Date.now();
    if (args.reattach) {
      const device = await ctx.db.get(args.reattach.deviceId);
      if (
        device &&
        device.userId === userId &&
        device.revokedAt === undefined &&
        device.reattachTokenHash !== undefined &&
        constantTimeStringEquals(
          device.reattachTokenHash,
          await sha256Hex(args.reattach.token),
        )
      ) {
        await ctx.db.patch(device._id, {
          sessionId: (await getAuthSessionId(ctx)) ?? undefined,
          reattachTokenHash: undefined,
          lastSeenAt: now,
        });
        return device._id;
      }
    }
    const isFirst =
      (await ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first()) === null;
    const label = args.label.trim().slice(0, MAX_LABEL_LENGTH);
    const deviceId = await ctx.db.insert("devices", {
      userId,
      kind: args.kind,
      label,
      country:
        /^[A-Z]{2}$/.test(audit.country) && audit.country !== "XX"
          ? audit.country
          : undefined,
      city: audit.city?.trim().slice(0, 80) || undefined,
      devicePublicKey: args.devicePublicKey,
      trusted: args.trusted,
      sessionId: (await getAuthSessionId(ctx)) ?? undefined,
      acknowledgedAt: isFirst ? now : undefined,
      lastSeenAt: now,
      createdAt: now,
    });
    if (!isFirst) {
      const user = await ctx.db.get(userId);
      await ctx.scheduler.runAfter(0, internal.dispatch.notifyNewDevice, {
        email: user?.email,
        phoneNumber: user?.phoneNumber,
        ownerName: user?.name,
        deviceLabel: label,
        language: user?.language,
        pushTokens: await activePushTokens(
          ctx,
          userId,
          await getAuthSessionId(ctx),
        ),
      });
    }
    return deviceId;
  },
  getResourceId: (_args, deviceId) => deviceId,
  getMetadata: (args, deviceId) => ({
    kind: args.kind,
    trusted: args.trusted,
    reattached: deviceId === args.reattach?.deviceId,
  }),
});

/**
 * Phone sign-out, called before the session ends: the account's alerts stop
 * reaching this phone, and the row stays for its next sign-in, which proves
 * itself with `reattachToken` (only its SHA-256 is kept). Only the session
 * on the row may do this, so no other device can mute this phone's alerts.
 */
export const signOut = auditedMutation({
  action: "device.signed_out",
  resourceType: "device",
  args: { deviceId: v.id("devices"), reattachToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const device = await requireOwnDevice(ctx, userId, args.deviceId);
    if (device.sessionId !== (await getAuthSessionId(ctx))) {
      throw new ConvexError("Not this device");
    }
    await ctx.db.patch(device._id, {
      reattachTokenHash: await sha256Hex(args.reattachToken),
    });
    const { pushToken } = device;
    if (pushToken === undefined) return;
    // Before phones kept one row, each sign-in left one with the same token.
    const sameToken = await ctx.db
      .query("devices")
      .withIndex("by_push_token", (q) => q.eq("pushToken", pushToken))
      .collect();
    for (const row of sameToken) {
      if (row.userId === userId) {
        await ctx.db.patch(row._id, { pushToken: undefined });
      }
    }
  },
  getResourceId: (args) => args.deviceId,
});

/**
 * Expo push tokens of the user's active phones, except the one on
 * `exceptSessionId` (the device that caused the alert). Once per token: rows
 * older sign-ins left on the same phone share it.
 */
export async function activePushTokens(
  ctx: QueryCtx,
  userId: Id<"users">,
  exceptSessionId: Id<"authSessions"> | null = null,
): Promise<string[]> {
  const devices = await ctx.db
    .query("devices")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const tokens = devices
    .filter(
      (d) =>
        d.revokedAt === undefined &&
        d.pushToken !== undefined &&
        d.sessionId !== exceptSessionId,
    )
    .map((d) => d.pushToken!);
  return [...new Set(tokens)];
}

/** Drop Expo push tokens the push service reports as unregistered. */
export const clearPushTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const pushToken of args.tokens) {
      const devices = await ctx.db
        .query("devices")
        .withIndex("by_push_token", (q) => q.eq("pushToken", pushToken))
        .collect();
      for (const device of devices) {
        await ctx.db.patch(device._id, { pushToken: undefined });
      }
    }
  },
});

/** Phone: store its Expo push token for security alerts. */
export const setPushToken = auditedMutation({
  action: "device.push_token_set",
  resourceType: "device",
  args: { deviceId: v.id("devices"), pushToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireOwnDevice(ctx, userId, args.deviceId);
    await ctx.db.patch(args.deviceId, { pushToken: args.pushToken });
  },
  getResourceId: (args) => args.deviceId,
});

/**
 * A browser link has expired once its session is gone (signed out, linked
 * again, or past expiry) and no passkey of it is left to sign back in: it can
 * only return through a new QR approval, which registers a new row. Phones
 * keep one row across sign-ins, so they never expire this way.
 */
async function isExpiredLink(ctx: QueryCtx, device: Doc<"devices">) {
  if (device.kind !== "web") return false;
  const session = device.sessionId && (await ctx.db.get(device.sessionId));
  if (session && session.expirationTime > Date.now()) return false;
  const passkey = await ctx.db
    .query("passkey_credentials")
    .withIndex("by_keeplas_device", (q) => q.eq("keeplasDeviceId", device._id))
    .first();
  return passkey === null;
}

/** Active (non-revoked, unexpired) devices of the signed-in user, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const active: Doc<"devices">[] = [];
    for (const device of devices) {
      if (
        device.revokedAt === undefined &&
        !(await isExpiredLink(ctx, device))
      ) {
        active.push(device);
      }
    }
    return active;
  },
});

/** New devices still waiting for "It was me" / "It wasn't me" (M08-4). */
export const pendingAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return [];
    const sessionId = await getAuthSessionId(ctx);
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return devices.filter(
      (d) =>
        d.acknowledgedAt === undefined &&
        d.revokedAt === undefined &&
        d.sessionId !== sessionId,
    );
  },
});

async function requireOwnDevice(
  ctx: MutationCtx,
  userId: Id<"users">,
  deviceId: Id<"devices">,
) {
  const device = await ctx.db.get(deviceId);
  if (!device || device.userId !== userId || device.revokedAt !== undefined) {
    throw new ConvexError("Unknown device");
  }
  return device;
}

/**
 * Cut a device off: mark it revoked, end its session and delete the passkeys
 * created on it, so it cannot sign in again without a new QR approval.
 */
async function revokeDevice(ctx: MutationCtx, device: Doc<"devices">) {
  await ctx.db.patch(device._id, { revokedAt: Date.now() });
  if (device.sessionId) await endSession(ctx, device.sessionId);
  const passkeys = await ctx.db
    .query("passkey_credentials")
    .withIndex("by_keeplas_device", (q) => q.eq("keeplasDeviceId", device._id))
    .collect();
  for (const passkey of passkeys) await ctx.db.delete(passkey._id);
}

/** "It was me": dismiss the alert. */
export const confirm = auditedMutation({
  action: "device.confirmed",
  resourceType: "device",
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await requireOwnDevice(ctx, userId, args.deviceId);
    await ctx.db.patch(args.deviceId, { acknowledgedAt: Date.now() });
  },
  getResourceId: (args) => args.deviceId,
});

/** Remove a device from W04-6 / M08-3. */
export const revoke = auditedMutation({
  action: "device.revoked",
  resourceType: "device",
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const device = await requireOwnDevice(ctx, userId, args.deviceId);
    if (device.sessionId === (await getAuthSessionId(ctx))) {
      throw new ConvexError("Sign out instead of removing this device");
    }
    await revokeDevice(ctx, device);
  },
  getResourceId: (args) => args.deviceId,
});

/**
 * "It wasn't me" (M09-1 → M09-2): revoke the device, end every other session,
 * cancel a recovery in progress, and require a master-key rotation, which
 * this device performs next.
 */
export const notMe = auditedMutation({
  action: "device.not_me",
  resourceType: "device",
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const device = await requireOwnDevice(ctx, userId, args.deviceId);
    const currentSession = await getAuthSessionId(ctx);
    if (device.sessionId === currentSession) {
      throw new ConvexError("This is the device you are using");
    }
    // Counts the device's own session too; revokeDevice then finds it gone.
    const sessionsEnded = await endSessions(ctx, userId, currentSession);
    await revokeDevice(ctx, device);
    const recoveryCancelled = await cancelActiveRecovery(ctx, userId);
    await ctx.db.patch(userId, {
      masterKeyRotationRequired: true,
      updatedAt: Date.now(),
    });
    return { deviceLabel: device.label, sessionsEnded, recoveryCancelled };
  },
  getResourceId: (args) => args.deviceId,
  getMetadata: (_args, result) => result,
});
