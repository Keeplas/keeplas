import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAuth } from "./helpers";
import { createAuditLog } from "./audit";
import { internal } from "./_generated/api";

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

/**
 * Get Life Check configuration for the current user.
 */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Create or update Life Check configuration.
 */
export const saveConfig = mutation({
  args: {
    frequency: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly")
    ),
    activeChannels: v.array(
      v.object({
        type: v.union(
          v.literal("push"),
          v.literal("email"),
          v.literal("whatsapp"),
          v.literal("sms"),
          v.literal("ivr_call"),
          v.literal("first_responder")
        ),
        order: v.number(),
        isEnabled: v.boolean(),
        delayHours: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const nextCheckAt =
      now + FREQUENCY_DAYS[args.frequency] * 24 * 60 * 60 * 1000;

    const existing = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        frequency: args.frequency,
        activeChannels: args.activeChannels,
        nextCheckAt,
        isActive: true,
        updatedAt: now,
      });

      await createAuditLog(ctx, {
        userId,
        actorType: "user",
        actorId: userId,
        action: "life_check_configured",
        resourceType: "life_check_config",
        resourceId: existing._id,
      });

      return { configId: existing._id };
    }

    const configId = await ctx.db.insert("life_check_configs", {
      userId,
      frequency: args.frequency,
      passiveSignals: {
        appActivity: true,
        deviceActivity: false,
        gpsMovement: false,
        whatsappActivity: false,
        googleActivity: false,
        healthData: false,
        appleWatch: false,
      },
      activeChannels: args.activeChannels,
      travelModeEnabled: false,
      expeditionMode: false,
      isActive: true,
      nextCheckAt,
      confidenceThreshold: 50,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "life_check_configured",
      resourceType: "life_check_config",
      resourceId: configId,
    });

    return { configId };
  },
});

/**
 * Toggle travel mode.
 */
export const toggleTravelMode = mutation({
  args: {
    enabled: v.boolean(),
    until: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!config) throw new Error("Life Check not configured");

    // Max 90 days
    if (args.enabled && args.until) {
      const maxUntil = Date.now() + 90 * 24 * 60 * 60 * 1000;
      if (args.until > maxUntil) {
        throw new Error("Travel mode maximum is 90 days");
      }
    }

    await ctx.db.patch(config._id, {
      travelModeEnabled: args.enabled,
      travelModeUntil: args.enabled ? args.until : undefined,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: args.enabled
        ? "travel_mode_enabled"
        : "travel_mode_disabled",
      resourceType: "life_check_config",
      resourceId: config._id,
    });

    return { success: true };
  },
});

/**
 * Validate the current Life Check cycle (user confirms they're alive).
 */
export const validateCycle = mutation({
  args: {
    method: v.union(
      v.literal("tap"),
      v.literal("email_link"),
      v.literal("first_responder")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Find the active cycle
    const cycle = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .first();

    const escalatingCycle =
      cycle ??
      (await ctx.db
        .query("life_check_cycles")
        .withIndex("by_status", (q) =>
          q.eq("userId", userId).eq("status", "escalating")
        )
        .first());

    if (!escalatingCycle) {
      throw new Error("No active Life Check cycle found");
    }

    const now = Date.now();

    await ctx.db.patch(escalatingCycle._id, {
      status: "validated",
      validatedAt: now,
      validatedBy: args.method,
      completedAt: now,
    });

    // Update config with next check time
    const config = await ctx.db.get(escalatingCycle.configId);
    if (config) {
      const nextCheckAt =
        now +
        FREQUENCY_DAYS[config.frequency] * 24 * 60 * 60 * 1000;
      await ctx.db.patch(config._id, {
        lastCheckAt: now,
        nextCheckAt,
        updatedAt: now,
      });
    }

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "life_check_validated",
      resourceType: "life_check_cycle",
      resourceId: escalatingCycle._id,
      metadata: JSON.stringify({ method: args.method }),
    });

    return { success: true };
  },
});

/**
 * Postpone the current Life Check.
 */
export const postponeCycle = mutation({
  args: {
    duration: v.union(
      v.literal("48h"),
      v.literal("7d"),
      v.literal("custom")
    ),
    customDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!config) throw new Error("Life Check not configured");

    const now = Date.now();
    let newNextCheck: number;

    if (args.duration === "48h") {
      newNextCheck = now + 48 * 60 * 60 * 1000;
    } else if (args.duration === "7d") {
      newNextCheck = now + 7 * 24 * 60 * 60 * 1000;
    } else if (args.customDate) {
      newNextCheck = args.customDate;
    } else {
      throw new Error("Custom date required for custom duration");
    }

    // Cancel active cycle if any
    const activeCycle = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .first();

    if (activeCycle) {
      await ctx.db.patch(activeCycle._id, {
        status: "cancelled",
        cancelledAt: now,
        cancelledReason: `Postponed ${args.duration}`,
        completedAt: now,
      });
    }

    await ctx.db.patch(config._id, {
      nextCheckAt: newNextCheck,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "life_check_postponed",
      resourceType: "life_check_config",
      resourceId: config._id,
      metadata: JSON.stringify({ duration: args.duration }),
    });

    return { success: true };
  },
});

/**
 * Get Life Check cycle history.
 */
export const getCycleHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("life_check_cycles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get the current active cycle.
 */
export const getActiveCycle = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const running = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .first();

    if (running) return running;

    return await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "escalating")
      )
      .first();
  },
});

/**
 * Internal: Initiate a new Life Check cycle (called by scheduled function).
 */
export const initiateCycle = internalMutation({
  args: { configId: v.id("life_check_configs") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config || !config.isActive) return;

    // Skip if travel mode is active
    if (config.travelModeEnabled) {
      if (config.travelModeUntil && Date.now() < config.travelModeUntil) {
        return;
      }
      // Travel mode expired, disable it
      await ctx.db.patch(config._id, {
        travelModeEnabled: false,
        travelModeUntil: undefined,
        updatedAt: Date.now(),
      });
    }

    const now = Date.now();

    // Create a new cycle
    const cycleId = await ctx.db.insert("life_check_cycles", {
      userId: config.userId,
      configId: args.configId,
      status: "running",
      passiveScore: 0,
      currentLevel: 1,
      levelReachedAt: now,
      channelsAttempted: [],
      scheduledAt: now,
      startedAt: now,
    });

    // Create notification
    await ctx.db.insert("notifications", {
      userId: config.userId,
      type: "life_check",
      title: "Life Check",
      body: "Confirm you are well. Tap to verify.",
      actionUrl: "/life-check",
      channels: ["push"],
      isRead: false,
      relatedId: cycleId,
      relatedType: "life_check_cycle",
      createdAt: now,
    });

    await createAuditLog(ctx, {
      userId: config.userId,
      actorType: "system",
      actorId: "life_check_scheduler",
      action: "life_check_cycle_started",
      resourceType: "life_check_cycle",
      resourceId: cycleId,
    });
  },
});

/**
 * Toggle Life Check active status.
 */
export const toggleActive = mutation({
  args: { isActive: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!config) throw new Error("Life Check not configured");

    await ctx.db.patch(config._id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
