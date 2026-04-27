import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth } from "./helpers";
import { auditedMutation } from "./audit";

const ACTION_TYPE = v.union(
  v.literal("grant_access"),
  v.literal("alert_authority"),
  v.literal("account_wipe")
);

const STEP_CATEGORY = v.union(
  v.literal("primary_outreach"),
  v.literal("incapacity"),
  v.literal("posthumous_release"),
  v.literal("wipe")
);

/**
 * Get the user's scenario (single per user for now) plus its ordered steps.
 */
export const getScenario = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const scenario = await ctx.db
      .query("scenarios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!scenario) return null;

    const steps = await ctx.db
      .query("scenario_steps")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenario._id))
      .collect();

    steps.sort((a, b) => a.triggerValue - b.triggerValue);

    return { scenario, steps };
  },
});

/**
 * Create scenario lazily if missing and return its ID.
 */
export const getOrCreateScenario = auditedMutation({
  action: "scenario.created",
  resourceType: "scenario",
  getResourceId: (_args, result) => result as string,
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const existing = await ctx.db
      .query("scenarios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    const id = await ctx.db.insert("scenarios", {
      userId,
      title: "Continuity Protocol",
      description: "Triggered actions across inactivity milestones.",
      status: "armed",
      isSafePauseActive: false,
      latentIntegrity: 100,
      syncHash: "init",
      triggerProtocol: "AES-256-GCM / ZK Threshold",
      lastCheckAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Toggle Safe Pause on the scenario.
 */
export const setSafePause = auditedMutation({
  action: "scenario.safe_pause_toggled",
  resourceType: "scenario",
  getMetadata: (args) => ({ paused: args.paused, until: args.until }),
  args: { paused: v.boolean(), until: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const scenario = await ctx.db
      .query("scenarios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!scenario) throw new Error("Scenario not initialized");

    await ctx.db.patch(scenario._id, {
      isSafePauseActive: args.paused,
      safePauseUntil: args.paused ? args.until : undefined,
      status: args.paused ? "paused" : "armed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Add a milestone step (e.g. T+7 days) with one or more actions.
 */
export const addStep = auditedMutation({
  action: "scenario.step_added",
  resourceType: "scenario_step",
  getResourceId: (_args, result) => result as string,
  getMetadata: (args) => ({ triggerValue: args.triggerValue }),
  args: {
    triggerValue: v.number(),
    label: v.string(),
    category: v.optional(STEP_CATEGORY),
    actions: v.array(
      v.object({
        actionType: ACTION_TYPE,
        targetContactId: v.optional(v.id("trusted_contacts")),
        config: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    let scenario = await ctx.db
      .query("scenarios")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!scenario) {
      const now = Date.now();
      const id = await ctx.db.insert("scenarios", {
        userId,
        title: "Continuity Protocol",
        description: "Triggered actions across inactivity milestones.",
        status: "armed",
        isSafePauseActive: false,
        latentIntegrity: 100,
        syncHash: "init",
        triggerProtocol: "AES-256-GCM / ZK Threshold",
        lastCheckAt: now,
        createdAt: now,
        updatedAt: now,
      });
      scenario = await ctx.db.get(id);
    }
    if (!scenario) throw new Error("Failed to initialize scenario");

    const existingSteps = await ctx.db
      .query("scenario_steps")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenario._id))
      .collect();

    const stepId = await ctx.db.insert("scenario_steps", {
      scenarioId: scenario._id,
      userId,
      triggerType: "inactivity_days",
      triggerValue: args.triggerValue,
      label: args.label,
      category: args.category,
      actions: args.actions,
      executionStatus: "pending",
      order: existingSteps.length,
      createdAt: Date.now(),
    });

    return stepId;
  },
});

/**
 * Update an existing milestone step. Only the fields the user can edit
 * from the dialog (trigger window, label, phase, action set) are mutable —
 * `order`, `executionStatus`, and `triggerType` stay under engine control.
 */
export const updateStep = auditedMutation({
  action: "scenario.step_updated",
  resourceType: "scenario_step",
  getResourceId: (args) => args.stepId,
  getMetadata: (args) => ({ triggerValue: args.triggerValue }),
  args: {
    stepId: v.id("scenario_steps"),
    triggerValue: v.number(),
    label: v.string(),
    category: v.optional(STEP_CATEGORY),
    actions: v.array(
      v.object({
        actionType: ACTION_TYPE,
        targetContactId: v.optional(v.id("trusted_contacts")),
        config: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const step = await ctx.db.get(args.stepId);
    if (!step || step.userId !== userId) throw new Error("Step not found");

    await ctx.db.patch(args.stepId, {
      triggerValue: args.triggerValue,
      label: args.label,
      category: args.category,
      actions: args.actions,
    });

    return { success: true };
  },
});

/**
 * Remove a milestone step.
 */
export const removeStep = auditedMutation({
  action: "scenario.step_removed",
  resourceType: "scenario_step",
  getResourceId: (args) => args.stepId,
  args: { stepId: v.id("scenario_steps") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const step = await ctx.db.get(args.stepId);
    if (!step || step.userId !== userId) throw new Error("Step not found");

    await ctx.db.delete(args.stepId);

    return { success: true };
  },
});
