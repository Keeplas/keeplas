import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalAuth, requireAuth } from "./helpers";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    return await ctx.db.get(userId);
  },
});

/**
 * Update the user's profile fields (name, phone, avatar).
 * Email is controlled by the auth provider and cannot be changed here.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.phoneNumber !== undefined)
      patch.phoneNumber = args.phoneNumber.trim() || undefined;
    if (args.avatarUrl !== undefined)
      patch.avatarUrl = args.avatarUrl.trim() || undefined;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Update the user's platform preferences (language, timezone).
 */
export const updatePreferences = mutation({
  args: {
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.language !== undefined) patch.language = args.language;
    if (args.timezone !== undefined) patch.timezone = args.timezone;

    await ctx.db.patch(userId, patch);
  },
});
