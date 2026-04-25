import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";

/**
 * Register a Web Push subscription for the authenticated user. Idempotent
 * by `endpoint`: a duplicate registration refreshes the keys and bumps
 * `lastUsedAt` instead of creating a new row.
 */
export const subscribe = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    deviceLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("push_subscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("Subscription belongs to another user");
      }
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        deviceLabel: args.deviceLabel ?? existing.deviceLabel,
        lastUsedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("push_subscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      deviceLabel: args.deviceLabel,
      createdAt: now,
      lastUsedAt: now,
    });
  },
});

/**
 * Remove a subscription by its endpoint URL. Used when the browser tells
 * us the subscription has been revoked or when the user opts out.
 */
export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const sub = await ctx.db
      .query("push_subscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (!sub || sub.userId !== userId) return { removed: false };
    await ctx.db.delete(sub._id);
    return { removed: true };
  },
});

/**
 * List the authenticated user's active subscriptions. Used by the settings
 * UI to show registered devices.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("push_subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
