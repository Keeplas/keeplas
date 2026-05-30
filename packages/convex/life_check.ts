import { v } from "convex/values";
import {
  action,
  mutation,
  query,
  internalMutation,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { createNotification, requireFullAuth } from "./helpers";
import { createAuditLog } from "./audit";
import { internal } from "./_generated/api";
import { verifyLifeCheckToken } from "./lib/life_check_token";

const FREQUENCY_DAYS: Record<string, number> = {
  // "test" is a 60-second dev cadence stored as a fractional day so it flows
  // through the same day-based threshold math (60s = 60/86400 days). Not a real
  // continuity setting — note the inactivity evaluator only runs hourly, so the
  // cycle still starts on the next evaluator tick, not exactly 60s later.
  test: 60 / 86_400,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stage-1 user check-in window: once the cadence elapses the user has this many
 * days to confirm (one-click email, WhatsApp reply, or in-app tap) before the
 * cycle hands off to the next stage. The check-in is fanned out at J+0 and then
 * re-sent at each reminder day below — at the default 15-day window that is
 * J+0, J+3, J+7 and J+10, with the handoff at J+15.
 */
const CHECK_IN_WINDOW_DAYS = 15;
/** Reminder day offsets within the window. J+0 is the initial fan-out. */
const REMINDER_DAYS = [3, 7, 10] as const;

/** Stage-2: how long trusted contacts have to confirm before the fallback. */
const CONFIRMATION_WINDOW_DAYS = 7;

/**
 * Resolve the inactivity threshold for a config. Falls back to the legacy
 * `frequency` mapping when `inactivityThresholdDays` is not yet populated.
 */
export function resolveThresholdDays(config: {
  frequency: "test" | "weekly" | "monthly" | "quarterly";
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
    const userId = await requireFullAuth(ctx);
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
      v.literal("test"),
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
        ),
        order: v.number(),
        isEnabled: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
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
      activeChannels: args.activeChannels,
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt,
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
    const userId = await requireFullAuth(ctx);

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
 * Validate the current Life Check cycle (user confirms they're alive via the
 * in-app tap or a one-click email link). Lenient: also resets the counter when
 * no cycle is in flight, so a proactive confirmation simply extends the
 * countdown. See `confirmAlive`.
 */
export const validateCycle = mutation({
  args: {
    method: v.union(v.literal("tap"), v.literal("email_link")),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await confirmAlive(ctx, userId, Date.now(), args.method);
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
    const userId = await requireFullAuth(ctx);

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
    const userId = await requireFullAuth(ctx);
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
    const userId = await requireFullAuth(ctx);

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
        q.eq("userId", userId).eq("status", "awaiting_confirmation"),
      )
      .first();
  },
});

type ChannelEntry = {
  type: "push" | "email" | "whatsapp";
  order: number;
  isEnabled: boolean;
};

function enabledChannels(channels: ChannelEntry[]): ChannelEntry[] {
  return channels.filter((c) => c.isEnabled);
}

/**
 * Insert a new Life Check cycle for a config and notify the user. Shared
 * by `initiateCycle` (legacy entry) and the cron evaluator. Fans out every
 * enabled channel at once, schedules reminders across the check-in window,
 * and schedules the handoff at the window's end. Returns the new cycle ID,
 * or null when the config is inactive / blocked by travel mode.
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

  const enabled = enabledChannels(config.activeChannels);
  if (enabled.length === 0) return null;

  const now = Date.now();
  const windowMs = (config.checkInWindowDays ?? CHECK_IN_WINDOW_DAYS) * DAY_MS;

  const cycleId = await ctx.db.insert("life_check_cycles", {
    userId: config.userId,
    configId,
    status: "running",
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

  // Explicit dead-man's switch: fan out every enabled channel at once (no
  // per-channel cascade), repeat the reminder at each reminder day, then hand
  // off when the window closes if the user never confirmed.
  const scheduleIds: Id<"_scheduled_functions">[] = [];
  for (const channel of enabled) {
    scheduleIds.push(
      await ctx.scheduler.runAfter(0, internal.dispatch.sendChannel, {
        cycleId,
        channelType: channel.type,
      }),
    );
  }
  for (const day of REMINDER_DAYS) {
    if (day * DAY_MS >= windowMs) continue; // a reminder must land before handoff
    scheduleIds.push(
      await ctx.scheduler.runAfter(
        day * DAY_MS,
        internal.life_check.sendReminder,
        { cycleId },
      ),
    );
  }
  scheduleIds.push(
    await ctx.scheduler.runAfter(
      windowMs,
      internal.life_check.enterConfirmationStage,
      { cycleId },
    ),
  );

  await ctx.db.patch(cycleId, { pendingScheduleIds: scheduleIds });

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
 * Re-send the check-in on every enabled channel. Scheduled at each reminder
 * fraction of the check-in window. No-ops once the cycle leaves "running" (the
 * user confirmed, or the window already closed and the cycle handed off).
 */
export const sendReminder = internalMutation({
  args: { cycleId: v.id("life_check_cycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.status !== "running") return;

    const config = await ctx.db.get(cycle.configId);
    if (!config) return;

    const newIds: Id<"_scheduled_functions">[] = [];
    for (const channel of enabledChannels(config.activeChannels)) {
      newIds.push(
        await ctx.scheduler.runAfter(0, internal.dispatch.sendChannel, {
          cycleId: args.cycleId,
          channelType: channel.type,
        }),
      );
    }

    await ctx.db.patch(args.cycleId, {
      pendingScheduleIds: [...(cycle.pendingScheduleIds ?? []), ...newIds],
    });
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
 * Find the user's in-flight Life Check cycle, if any.
 */
async function findInFlightCycle(ctx: MutationCtx, userId: Id<"users">) {
  const statuses = ["running", "awaiting_confirmation"] as const;
  for (const status of statuses) {
    const cycle = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", status),
      )
      .first();
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Record an explicit liveness confirmation: reset the inactivity counter and
 * validate any in-flight cycle. In the explicit dead-man's switch model this
 * is the ONLY proof of liveness — an in-app tap, a one-click email
 * confirmation, or a WhatsApp reply. App usage / passive signals no longer
 * reset the counter. Audit-logged so the confirmation is traceable.
 */
export async function confirmAlive(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  method: string,
) {
  const config = await ctx.db
    .query("life_check_configs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!config) return;

  await ctx.db.patch(config._id, {
    lastCheckAt: now,
    lastActivityAt: now,
    nextCheckAt: now + resolveThresholdDays(config) * DAY_MS,
    updatedAt: now,
  });

  // The user is alive — cancel any in-progress trusted-contact confirmation.
  const pendingRequests = await ctx.db
    .query("access_requests")
    .withIndex("by_status", (q) =>
      q.eq("vaultUserId", userId).eq("status", "pending"),
    )
    .collect();
  for (const req of pendingRequests) {
    await ctx.db.patch(req._id, {
      status: "denied",
      cancelledDuringGrace: true,
      respondedAt: now,
      updatedAt: now,
    });
  }

  const cycle = await findInFlightCycle(ctx, userId);
  if (!cycle) return;

  await ctx.db.patch(cycle._id, {
    status: "validated",
    validatedAt: now,
    validatedBy: method,
    completedAt: now,
  });

  await cancelPendingSchedules(ctx, cycle._id);

  await createAuditLog(ctx, {
    userId,
    actorType: "user",
    actorId: userId,
    action: "life_check_validated",
    resourceType: "life_check_cycle",
    resourceId: cycle._id,
    metadata: JSON.stringify({ method }),
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
    await confirmAlive(ctx, user._id, now, "whatsapp");
    return { matched: true };
  },
});

/**
 * Validate a cycle from the one-click email link. The HMAC token is verified
 * upstream in `confirmFromEmailToken`; here we just confirm the cycle belongs
 * to the user, then run the shared `confirmAlive`. Idempotent.
 */
export const confirmFromEmail = internalMutation({
  args: {
    cycleId: v.id("life_check_cycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.userId !== args.userId) return { ok: false };
    await confirmAlive(ctx, args.userId, Date.now(), "email_link");
    return { ok: true };
  },
});

/**
 * Public unauthenticated action invoked from the Next.js confirm page when the
 * user clicks the "I am well" button in the check-in email. Verifies the
 * HMAC-signed token (proves the call came from a real check-in email) and
 * runs the shared confirmation mutation. Never exposes vault data — the token
 * only authorises resetting a liveness timer. Kept as an `action` (not a
 * mutation) because token verification uses WebCrypto, which is only available
 * in the action runtime.
 */
export const confirmFromEmailToken = action({
  args: { token: v.string() },
  returns: v.union(v.literal("ok"), v.literal("invalid")),
  handler: async (ctx, args) => {
    const payload = await verifyLifeCheckToken(args.token);
    if (!payload) return "invalid";
    await ctx.runMutation(internal.life_check.confirmFromEmail, {
      cycleId: payload.cycleId as Id<"life_check_cycles">,
      userId: payload.userId as Id<"users">,
    });
    return "ok";
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

      const inFlight = await findInFlightCycle(ctx, config.userId);
      if (inFlight) continue;

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
  reason: string = "life_check_triggered",
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
    metadata: JSON.stringify({ reason }),
  });

  // Hand off to the per-recipient release fan-out (each trusted contact gets
  // the vault items meant for them, at their access level). The previous
  // Scenario Engine handoff is gone — release is the single, legible outcome.
  await ctx.scheduler.runAfter(0, internal.release.triggerRelease, {
    userId: cycle.userId,
    reason,
  });
}

/**
 * Stage-1 → Stage-2 transition. The user never confirmed across the whole
 * check-in window, so the cycle moves to `awaiting_confirmation` and the
 * owner's accepted trust contacts are asked to confirm unreachability. A
 * release only happens once enough contacts confirm (see access_requests) or,
 * at the window's end, per the owner's fallback policy.
 */
export const enterConfirmationStage = internalMutation({
  args: { cycleId: v.id("life_check_cycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.status !== "running") return;

    const config = await ctx.db.get(cycle.configId);
    if (!config) return;

    const now = Date.now();
    await ctx.db.patch(cycle._id, {
      status: "awaiting_confirmation",
    });

    const owner = await ctx.db.get(cycle.userId);
    const ownerName = owner?.name ?? "A Keeplas user";

    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", cycle.userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    for (const contact of contacts) {
      if ((contact.contactType ?? "trust") !== "trust") continue;
      if (!contact.contactUserId) continue;
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "security_alert",
        title: "Action needed: confirm a contact's status",
        body: `${ownerName} has stopped responding to their Keeplas check-ins. If you cannot reach them, confirm they are unavailable.`,
        actionUrl: "/shared-with-me",
        channels: ["push", "email"],
        relatedId: cycle._id,
        relatedType: "life_check_cycle",
      });
    }

    const windowDays =
      config.confirmationWindowDays ?? CONFIRMATION_WINDOW_DAYS;
    const resolveId = await ctx.scheduler.runAfter(
      windowDays * DAY_MS,
      internal.life_check.resolveConfirmationWindow,
      { cycleId: cycle._id },
    );
    await ctx.db.patch(cycle._id, {
      pendingScheduleIds: [...(cycle.pendingScheduleIds ?? []), resolveId],
    });

    await createAuditLog(ctx, {
      userId: cycle.userId,
      actorType: "system",
      actorId: "life_check_scheduler",
      action: "life_check_awaiting_confirmation",
      resourceType: "life_check_cycle",
      resourceId: cycle._id,
    });
  },
});

/**
 * Confirmation window elapsed. If contacts reached the confirmation threshold,
 * a release is already pending behind its owner-cancel grace — do nothing.
 * Otherwise apply the owner's fallback: "abort" (release nothing, notify the
 * owner) or "release_anyway" (release without human confirmation). The default
 * when unset is "abort" — releasing on cron timers alone must be an explicit
 * owner opt-in (see finding H1).
 */
export const resolveConfirmationWindow = internalMutation({
  args: { cycleId: v.id("life_check_cycles") },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.status !== "awaiting_confirmation") return;

    const confirmed = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", cycle.userId).eq("status", "pending"),
      )
      .filter((q) => q.eq(q.field("quorumReached"), true))
      .first();
    if (confirmed) return; // release will fire after its grace window

    const config = await ctx.db.get(cycle.configId);
    // Safe default: when the owner never explicitly opted into "release_anyway",
    // a confirmation window that elapses without human quorum must NOT release
    // the vault. An attacker who suppresses the owner's check-ins must not be
    // able to force a release purely on cron timers. Absent config => "abort".
    const fallback = config?.fallbackBehavior ?? "abort";

    if (fallback === "release_anyway") {
      await markCycleTriggered(ctx, cycle._id, "life_check_fallback_release");
      return;
    }

    const now = Date.now();
    await ctx.db.patch(cycle._id, {
      status: "cancelled",
      cancelledAt: now,
      cancelledReason: "no_contact_confirmation",
      completedAt: now,
    });

    const pending = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", cycle.userId).eq("status", "pending"),
      )
      .collect();
    for (const req of pending) {
      await ctx.db.patch(req._id, { status: "expired", updatedAt: now });
    }

    // Notify the owner: the vault stayed locked because no human confirmed
    // unreachability within the window. If they are in fact away, this is the
    // signal to add/re-confirm trusted contacts or switch to "release_anyway".
    await createNotification(ctx, {
      userId: cycle.userId,
      type: "security_alert",
      title: "Life Check closed without release",
      body: "Your check-in window ended without enough trusted contacts confirming you were unavailable, so your vault stayed locked. No data was released.",
      actionUrl: "/life-check",
      channels: ["push", "email"],
      relatedId: cycle._id,
      relatedType: "life_check_cycle",
    });

    await createAuditLog(ctx, {
      userId: cycle.userId,
      actorType: "system",
      actorId: "life_check_scheduler",
      action: "life_check_aborted_no_confirmation",
      resourceType: "life_check_cycle",
      resourceId: cycle._id,
    });
  },
});

/**
 * Fired after the owner-cancel grace window once enough trusted contacts have
 * confirmed unreachability (scheduled by access_requests.markUserUnreachable).
 * Re-checks state, then releases. Bails if the user came back (cycle no longer
 * `awaiting_confirmation`) or the request was cancelled during grace.
 */
export const releaseAfterConfirmation = internalMutation({
  args: {
    userId: v.id("users"),
    requestId: v.id("access_requests"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.cancelledDuringGrace ||
      request.status !== "pending"
    )
      return;

    const cycle = await findInFlightCycle(ctx, args.userId);
    if (!cycle || cycle.status !== "awaiting_confirmation") return;

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "approved",
      respondedAt: now,
      updatedAt: now,
    });

    await markCycleTriggered(ctx, cycle._id, "life_check_confirmed");
  },
});

/**
 * Toggle Life Check active status.
 */
export const toggleActive = mutation({
  args: { isActive: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

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

/**
 * Persist the Stage-2 release policy: how many trusted contacts must confirm
 * unavailability, how long they have, and what happens if they don't. Read by
 * `enterConfirmationStage` / `resolveConfirmationWindow` / `markUserUnreachable`.
 */
export const saveReleasePolicy = mutation({
  args: {
    confirmationThreshold: v.number(),
    confirmationWindowDays: v.number(),
    fallbackBehavior: v.union(v.literal("abort"), v.literal("release_anyway")),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    if (args.confirmationThreshold < 1 || args.confirmationThreshold > 10) {
      throw new Error("Confirmation threshold must be between 1 and 10");
    }
    if (args.confirmationWindowDays < 1 || args.confirmationWindowDays > 90) {
      throw new Error("Confirmation window must be between 1 and 90 days");
    }

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!config) throw new Error("Life Check not configured");

    await ctx.db.patch(config._id, {
      confirmationThreshold: args.confirmationThreshold,
      confirmationWindowDays: args.confirmationWindowDays,
      fallbackBehavior: args.fallbackBehavior,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "life_check_release_policy_saved",
      resourceType: "life_check_config",
      resourceId: config._id,
      metadata: JSON.stringify({
        confirmationThreshold: args.confirmationThreshold,
        confirmationWindowDays: args.confirmationWindowDays,
        fallbackBehavior: args.fallbackBehavior,
      }),
    });

    return { success: true };
  },
});
