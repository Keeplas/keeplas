import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { createNotification, requireAuth } from "./helpers";
import { createAuditLog } from "./audit";
import { internal } from "./_generated/api";

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the inactivity threshold for a config. Falls back to the legacy
 * `frequency` mapping when `inactivityThresholdDays` is not yet populated.
 */
export function resolveThresholdDays(config: {
  frequency: "weekly" | "monthly" | "quarterly";
  inactivityThresholdDays?: number;
}): number {
  return config.inactivityThresholdDays ?? FREQUENCY_DAYS[config.frequency];
}

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
      v.literal("quarterly"),
    ),
    activeChannels: v.array(
      v.object({
        type: v.union(
          v.literal("push"),
          v.literal("email"),
          v.literal("whatsapp"),
          v.literal("sms"),
          v.literal("ivr_call"),
        ),
        order: v.number(),
        isEnabled: v.boolean(),
        delayHours: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const thresholdDays = FREQUENCY_DAYS[args.frequency];
    const nextCheckAt = now + thresholdDays * DAY_MS;

    const existing = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        frequency: args.frequency,
        inactivityThresholdDays: thresholdDays,
        lastActivityAt: existing.lastActivityAt ?? now,
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
      inactivityThresholdDays: thresholdDays,
      lastActivityAt: now,
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

    // Max 180 days
    if (args.enabled && args.until) {
      const maxUntil = Date.now() + 180 * 24 * 60 * 60 * 1000;
      if (args.until > maxUntil) {
        throw new Error("Travel mode maximum is 180 days");
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
      action: args.enabled ? "travel_mode_enabled" : "travel_mode_disabled",
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
    method: v.union(v.literal("tap"), v.literal("email_link")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Find the active cycle
    const cycle = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "running"),
      )
      .first();

    const escalatingCycle =
      cycle ??
      (await ctx.db
        .query("life_check_cycles")
        .withIndex("by_status", (q) =>
          q.eq("userId", userId).eq("status", "escalating"),
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
      const nextCheckAt = now + resolveThresholdDays(config) * DAY_MS;
      await ctx.db.patch(config._id, {
        lastCheckAt: now,
        lastActivityAt: now,
        nextCheckAt,
        updatedAt: now,
      });
    }

    await cancelPendingSchedules(ctx, escalatingCycle._id);

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
    duration: v.union(v.literal("48h"), v.literal("7d"), v.literal("custom")),
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
        q.eq("userId", userId).eq("status", "running"),
      )
      .first();

    if (activeCycle) {
      await ctx.db.patch(activeCycle._id, {
        status: "cancelled",
        cancelledAt: now,
        cancelledReason: `Postponed ${args.duration}`,
        completedAt: now,
      });
      await cancelPendingSchedules(ctx, activeCycle._id);
    }

    await ctx.db.patch(config._id, {
      nextCheckAt: newNextCheck,
      lastActivityAt: now,
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
        q.eq("userId", userId).eq("status", "running"),
      )
      .first();

    if (running) return running;

    return await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "escalating"),
      )
      .first();
  },
});

type ChannelEntry = {
  type: "push" | "email" | "whatsapp" | "sms" | "ivr_call";
  order: number;
  isEnabled: boolean;
  delayHours: number;
};

function enabledChannelsSorted(channels: ChannelEntry[]): ChannelEntry[] {
  return channels.filter((c) => c.isEnabled).sort((a, b) => a.order - b.order);
}

/**
 * Insert a new Life Check cycle for a config and notify the user. Shared
 * by `initiateCycle` (legacy entry) and the cron evaluator. Schedules the
 * first channel send + the first escalation in one shot. Returns the new
 * cycle ID, or null when the config is inactive / blocked by travel mode.
 */
async function startCycleForConfig(
  ctx: MutationCtx,
  configId: Id<"life_check_configs">,
): Promise<Id<"life_check_cycles"> | null> {
  const config = await ctx.db.get(configId);
  if (!config || !config.isActive) return null;

  if (config.travelModeEnabled) {
    if (config.travelModeUntil && Date.now() < config.travelModeUntil) {
      return null;
    }
    await ctx.db.patch(config._id, {
      travelModeEnabled: false,
      travelModeUntil: undefined,
      updatedAt: Date.now(),
    });
  }

  const enabled = enabledChannelsSorted(config.activeChannels);
  if (enabled.length === 0) return null;

  const now = Date.now();

  const cycleId = await ctx.db.insert("life_check_cycles", {
    userId: config.userId,
    configId,
    status: "running",
    passiveScore: 0,
    currentLevel: 1,
    levelReachedAt: now,
    channelsAttempted: [],
    pendingScheduleIds: [],
    scheduledAt: now,
    startedAt: now,
  });

  await createNotification(ctx, {
    userId: config.userId,
    type: "life_check",
    title: "Life Check",
    body: "Confirm you are well. Tap to verify.",
    actionUrl: "/life-check",
    relatedId: cycleId,
    relatedType: "life_check_cycle",
  });

  await createAuditLog(ctx, {
    userId: config.userId,
    actorType: "system",
    actorId: "life_check_scheduler",
    action: "life_check_cycle_started",
    resourceType: "life_check_cycle",
    resourceId: cycleId,
  });

  const first = enabled[0];
  const sendId = await ctx.scheduler.runAfter(
    0,
    internal.dispatch.sendChannel,
    { cycleId, channelType: first.type },
  );

  const followUpDelay = first.delayHours * 60 * 60 * 1000;
  let nextId: Id<"_scheduled_functions">;
  if (enabled.length > 1) {
    nextId = await ctx.scheduler.runAfter(
      followUpDelay,
      internal.life_check.escalateToNextChannel,
      { cycleId, fromOrder: enabled[1].order },
    );
  } else {
    nextId = await ctx.scheduler.runAfter(
      followUpDelay,
      internal.life_check.triggerCycleAndDispatch,
      { cycleId },
    );
  }

  await ctx.db.patch(cycleId, { pendingScheduleIds: [sendId, nextId] });

  return cycleId;
}

/**
 * Internal: Initiate a new Life Check cycle (legacy entry, kept for
 * backwards compatibility with any caller scheduling cycles directly).
 */
export const initiateCycle = internalMutation({
  args: { configId: v.id("life_check_configs") },
  handler: async (ctx, args) => {
    await startCycleForConfig(ctx, args.configId);
  },
});

/**
 * Cancel any scheduled escalation jobs attached to a cycle. Called when the
 * cycle is validated (passive activity, manual tap, or postponement).
 */
export async function cancelPendingSchedules(
  ctx: MutationCtx,
  cycleId: Id<"life_check_cycles">,
) {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle) return;
  const ids = cycle.pendingScheduleIds ?? [];
  if (ids.length === 0) return;

  for (const scheduleId of ids) {
    try {
      await ctx.scheduler.cancel(scheduleId);
    } catch {
      // Already executed or expired — ignore.
    }
  }

  await ctx.db.patch(cycleId, { pendingScheduleIds: [] });
}

/**
 * Record an activity ping for the user. Called from passive_signals on every
 * accepted signal. Refreshes `lastActivityAt` + `nextCheckAt`, and if a cycle
 * is currently `running` or `escalating`, validates it (full reset model).
 *
 * Exported as a plain helper so other modules (passive_signals, future
 * integrations) can hook in without going through the public mutation
 * surface. Audit-logged so the validation is traceable.
 */
export async function recordActivityInternal(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  source: string = "passive_app_activity",
) {
  const config = await ctx.db
    .query("life_check_configs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!config) return;

  const nextCheckAt = now + resolveThresholdDays(config) * DAY_MS;

  await ctx.db.patch(config._id, {
    lastActivityAt: now,
    nextCheckAt,
    updatedAt: now,
  });

  const running = await ctx.db
    .query("life_check_cycles")
    .withIndex("by_status", (q) =>
      q.eq("userId", userId).eq("status", "running"),
    )
    .first();

  const escalating =
    running ??
    (await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "escalating"),
      )
      .first());

  if (!escalating) return;

  await ctx.db.patch(escalating._id, {
    status: "validated",
    validatedAt: now,
    validatedBy: source,
    completedAt: now,
  });

  await cancelPendingSchedules(ctx, escalating._id);

  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "passive_signal_collector",
    action: "life_check_passive_validated",
    resourceType: "life_check_cycle",
    resourceId: escalating._id,
  });
}

/**
 * Validate a Life Check cycle from an inbound WhatsApp event (a free-text
 * reply or a Quick-reply button tap). Called by the Infobip inbound webhook
 * — no auth context — so the user is resolved by their verified phone number.
 * A mere read receipt is NOT routed here: only a deliberate reply counts as
 * liveness. No-ops silently when the phone maps to no user or there is no
 * cycle in flight.
 */
export const validateFromWhatsApp = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
    if (!user) return { matched: false };

    const now = Date.now();
    await ctx.db.patch(user._id, { lastSeenAt: now });
    await recordActivityInternal(ctx, user._id, now, "passive_whatsapp");
    return { matched: true };
  },
});

/**
 * Cron-driven evaluator. For every active config, decide whether the user
 * has crossed their inactivity threshold. If yes and no cycle is in flight,
 * initiate a new cycle. Travel mode skips evaluation (and auto-disables
 * once expired). Escalation timing across channels is handled in PR2.
 */
export const evaluateAllConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const configs = await ctx.db
      .query("life_check_configs")
      .withIndex("by_active_activity", (q) => q.eq("isActive", true))
      .collect();

    let initiated = 0;

    for (const config of configs) {
      if (config.travelModeEnabled) {
        if (
          config.travelModeUntil !== undefined &&
          now >= config.travelModeUntil
        ) {
          await ctx.db.patch(config._id, {
            travelModeEnabled: false,
            travelModeUntil: undefined,
            updatedAt: now,
          });
        } else {
          continue;
        }
      }

      const lastActivity = config.lastActivityAt ?? config.createdAt;
      const thresholdMs = resolveThresholdDays(config) * DAY_MS;
      if (now - lastActivity < thresholdMs) continue;

      const inFlight = await ctx.db
        .query("life_check_cycles")
        .withIndex("by_status", (q) =>
          q.eq("userId", config.userId).eq("status", "running"),
        )
        .first();
      if (inFlight) continue;

      const escalating = await ctx.db
        .query("life_check_cycles")
        .withIndex("by_status", (q) =>
          q.eq("userId", config.userId).eq("status", "escalating"),
        )
        .first();
      if (escalating) continue;

      const cycleId = await startCycleForConfig(ctx, config._id);
      if (cycleId) initiated++;
    }

    return { evaluated: configs.length, initiated };
  },
});

/**
 * Bundle of records the out-of-band dispatcher needs to send a single
 * channel. Kept as a single query so the action only does one round-trip
 * to the database before talking to the external API.
 */
export const getDispatchContext = internalQuery({
  args: { cycleId: v.id("life_check_cycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return null;
    const user = await ctx.db.get(cycle.userId);
    if (!user) return null;
    const pushSubscriptions = await ctx.db
      .query("push_subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", cycle.userId))
      .collect();
    return { cycle, user, pushSubscriptions };
  },
});

/**
 * Append a channel attempt to the cycle. Called by `dispatch.sendChannel`
 * once the external send (or no-op) returns. Skips if the cycle has
 * already been validated/cancelled in the meantime.
 */
export const recordChannelAttempt = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    channelType: v.string(),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return;
    if (cycle.status === "validated" || cycle.status === "cancelled") {
      return;
    }

    await ctx.db.patch(args.cycleId, {
      channelsAttempted: [
        ...cycle.channelsAttempted,
        {
          channelType: args.channelType,
          attemptedAt: Date.now(),
          response: args.response,
        },
      ],
    });
  },
});

/**
 * Move the cycle to its next escalation channel. If we have run out of
 * channels, the cycle is marked `triggered` and the scenario engine is
 * dispatched. Skips silently when the cycle is already validated/cancelled.
 */
export const escalateToNextChannel = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    fromOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return;
    if (
      cycle.status === "validated" ||
      cycle.status === "cancelled" ||
      cycle.status === "triggered"
    ) {
      return;
    }

    const config = await ctx.db.get(cycle.configId);
    if (!config) return;

    const enabled = enabledChannelsSorted(config.activeChannels);
    const idx = enabled.findIndex((c) => c.order >= args.fromOrder);

    if (idx === -1) {
      await markCycleTriggered(ctx, cycle._id);
      return;
    }

    const current = enabled[idx];
    const now = Date.now();

    if (cycle.status === "running") {
      await ctx.db.patch(cycle._id, {
        status: "escalating",
        currentLevel: cycle.currentLevel + 1,
        levelReachedAt: now,
      });
    }

    const sendId = await ctx.scheduler.runAfter(
      0,
      internal.dispatch.sendChannel,
      { cycleId: cycle._id, channelType: current.type },
    );

    const delay = current.delayHours * 60 * 60 * 1000;
    let nextId: Id<"_scheduled_functions">;
    if (idx + 1 < enabled.length) {
      nextId = await ctx.scheduler.runAfter(
        delay,
        internal.life_check.escalateToNextChannel,
        { cycleId: cycle._id, fromOrder: enabled[idx + 1].order },
      );
    } else {
      nextId = await ctx.scheduler.runAfter(
        delay,
        internal.life_check.triggerCycleAndDispatch,
        { cycleId: cycle._id },
      );
    }

    const refreshed = await ctx.db.get(cycle._id);
    const ids = refreshed?.pendingScheduleIds ?? [];
    await ctx.db.patch(cycle._id, {
      pendingScheduleIds: [...ids, sendId, nextId],
    });
  },
});

/**
 * Final transition: mark the cycle as `triggered` and hand off to the
 * Scenario Engine. Idempotent — repeated calls on a triggered cycle return
 * without further side effects.
 */
export const triggerCycleAndDispatch = internalMutation({
  args: { cycleId: v.id("life_check_cycles") },
  handler: async (ctx, args) => {
    await markCycleTriggered(ctx, args.cycleId);
  },
});

async function markCycleTriggered(
  ctx: MutationCtx,
  cycleId: Id<"life_check_cycles">,
) {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle) return;
  if (
    cycle.status === "validated" ||
    cycle.status === "cancelled" ||
    cycle.status === "triggered"
  ) {
    return;
  }

  const now = Date.now();
  await ctx.db.patch(cycleId, {
    status: "triggered",
    completedAt: now,
  });

  await createAuditLog(ctx, {
    userId: cycle.userId,
    actorType: "system",
    actorId: "life_check_scheduler",
    action: "life_check_cycle_triggered",
    resourceType: "life_check_cycle",
    resourceId: cycleId,
  });

  await ctx.scheduler.runAfter(0, internal.scenario_engine.dispatchScenario, {
    userId: cycle.userId,
    cycleId,
  });
}

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
