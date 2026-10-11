import { v } from "convex/values";
import { query } from "./_generated/server";
import { auditedMutation } from "./audit";
import { optionalAuth, requireAuth } from "./helpers";

const MAX_LABEL_LENGTH = 100;

/** Record the current device after sign-up or a QR link (workflow 8, step 16). */
export const register = auditedMutation({
  action: "device.registered",
  resourceType: "device",
  args: {
    kind: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    label: v.string(),
    devicePublicKey: v.optional(v.string()),
    trusted: v.boolean(),
  },
  getResourceId: (_args, deviceId) => deviceId as string,
  getMetadata: (args) => ({ kind: args.kind, trusted: args.trusted }),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    return await ctx.db.insert("devices", {
      userId,
      kind: args.kind,
      label: args.label.trim().slice(0, MAX_LABEL_LENGTH),
      devicePublicKey: args.devicePublicKey,
      trusted: args.trusted,
      lastSeenAt: now,
      createdAt: now,
    });
  },
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
