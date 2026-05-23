import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./helpers";

const SIGNAL_TYPE = v.union(
  v.literal("app_activity"),
  v.literal("device_unlock"),
  v.literal("gps_movement"),
  v.literal("whatsapp_presence"),
  v.literal("google_activity"),
  v.literal("health_data"),
  v.literal("apple_watch"),
);

const THROTTLE_MS = 60 * 60 * 1000;

const SCORE_BY_TYPE: Record<string, number> = {
  app_activity: 40,
  device_unlock: 25,
  gps_movement: 30,
  whatsapp_presence: 20,
  google_activity: 20,
  health_data: 35,
  apple_watch: 35,
};

/**
 * Record a passive activity signal from the authenticated user. Server-side
 * throttle: a new signal of the same `signalType` is ignored if the previous
 * one was recorded less than an hour ago. Used only to maintain `lastSeenAt`
 * (the "last access" display). In the explicit dead-man's switch model passive
 * activity NO LONGER resets the Life Check counter — only an explicit
 * confirmation (in-app tap, one-click email, or WhatsApp reply) does.
 */
export const recordSignal = mutation({
  args: { signalType: SIGNAL_TYPE },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const lastSignal = await ctx.db
      .query("passive_signals")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("signalType", args.signalType),
      )
      .order("desc")
      .first();

    if (lastSignal && now - lastSignal.detectedAt < THROTTLE_MS) {
      return { recorded: false, throttled: true };
    }

    await ctx.db.insert("passive_signals", {
      userId,
      signalType: args.signalType,
      scoreContribution: SCORE_BY_TYPE[args.signalType] ?? 10,
      detectedAt: now,
      validUntil: now + 24 * 60 * 60 * 1000,
    });

    await ctx.db.patch(userId, { lastSeenAt: now });

    return { recorded: true, throttled: false };
  },
});
