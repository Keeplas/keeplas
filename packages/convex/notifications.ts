import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireFullAuth } from "./helpers";

/**
 * Get all notifications for the authenticated user (most recent first).
 */
export const getNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const limit = args.limit ?? 20;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return notifications;
  },
});

/**
 * Get unread notification count.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_unread", (q) => q.eq("userId", userId).eq("isRead", false))
      .collect();
    return unread.length;
  },
});

/**
 * Mark a notification as read.
 */
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });
  },
});

/**
 * Mark all notifications as read.
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_unread", (q) => q.eq("userId", userId).eq("isRead", false))
      .collect();

    const now = Date.now();
    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true, readAt: now });
    }
  },
});
