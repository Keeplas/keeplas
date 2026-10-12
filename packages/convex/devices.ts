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
import { endSession, endSessions } from "./lib/sessions";
import { cancelActiveRecovery } from "./recovery";

const MAX_LABEL_LENGTH = 100;

/**
 * Record the current device after sign-up or a QR link (workflow 8, step 16).
 * Every device but the first raises a new-device alert (M08-4) on the others.
 */
export const register = auditedMutation({
  action: "device.registered",
  resourceType: "device",
  args: {
    kind: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    label: v.string(),
    devicePublicKey: v.optional(v.string()),
    trusted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
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
  getMetadata: (args) => ({ kind: args.kind, trusted: args.trusted }),
});

/**
 * Expo push tokens of the user's active phones, except the one on
 * `exceptSessionId` (the device that caused the alert).
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
  return devices
    .filter(
      (d) =>
        d.revokedAt === undefined &&
        d.pushToken !== undefined &&
        d.sessionId !== exceptSessionId,
    )
    .map((d) => d.pushToken!);
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

/** Active (non-revoked) devices of the signed-in user, newest first. */
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
    return devices.filter((d) => d.revokedAt === undefined);
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
