import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createAuditLog } from "./audit";
import { createNotification } from "./helpers";
import { wipeUserData } from "./users";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Entry point: called by Life Check once a cycle reaches `triggered`. Loads
 * the user's armed scenario, schedules each pending step at its absolute
 * inactivity offset (lastActivityAt + triggerValue days). Steps whose offset
 * is already in the past run immediately. Honors Safe Pause.
 */
export const dispatchScenario = internalMutation({
  args: {
    userId: v.id("users"),
    cycleId: v.id("life_check_cycles"),
  },
  handler: async (ctx, args) => {
    const scenario = await ctx.db
      .query("scenarios")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!scenario || scenario.status !== "armed") return;

    if (scenario.isSafePauseActive) {
      const until = scenario.safePauseUntil;
      if (until === undefined || until > Date.now()) {
        await createAuditLog(ctx, {
          userId: args.userId,
          actorType: "system",
          actorId: "scenario_engine",
          action: "scenario_skipped_safe_pause",
          resourceType: "scenario",
          resourceId: scenario._id,
        });
        return;
      }
      await ctx.db.patch(scenario._id, {
        isSafePauseActive: false,
        safePauseUntil: undefined,
      });
    }

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const lastActivityAt =
      config?.lastActivityAt ?? config?.createdAt ?? Date.now();

    const steps = await ctx.db
      .query("scenario_steps")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenario._id))
      .collect();
    steps.sort((a, b) => a.triggerValue - b.triggerValue);

    const now = Date.now();
    let scheduled = 0;

    for (const step of steps) {
      if (step.executionStatus !== "pending") continue;
      const target = lastActivityAt + step.triggerValue * DAY_MS;
      const delay = Math.max(0, target - now);
      await ctx.scheduler.runAfter(
        delay,
        internal.scenario_engine.executeStep,
        { stepId: step._id, cycleId: args.cycleId }
      );
      scheduled++;
    }

    await ctx.db.patch(scenario._id, {
      status: "triggered",
      lastCheckAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId: args.userId,
      actorType: "system",
      actorId: "scenario_engine",
      action: "scenario_dispatched",
      resourceType: "scenario",
      resourceId: scenario._id,
      metadata: JSON.stringify({ stepsScheduled: scheduled }),
    });
  },
});

/**
 * Run the actions of a single step. Skipped if the cycle has been
 * validated/cancelled in the meantime (user came back). Each action is
 * isolated — one failure does not block the others.
 */
export const executeStep = internalMutation({
  args: {
    stepId: v.id("scenario_steps"),
    cycleId: v.id("life_check_cycles"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step || step.executionStatus !== "pending") return;

    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.status !== "triggered") {
      await ctx.db.patch(args.stepId, {
        executionStatus: "skipped",
        executedAt: Date.now(),
      });
      return;
    }

    let allOk = true;
    for (const action of step.actions) {
      try {
        await dispatchAction(ctx, step.userId, action);
      } catch {
        allOk = false;
      }
    }

    await ctx.db.patch(args.stepId, {
      executionStatus: allOk ? "executed" : "failed",
      executedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId: step.userId,
      actorType: "system",
      actorId: "scenario_engine",
      action: allOk ? "scenario_step_executed" : "scenario_step_failed",
      resourceType: "scenario_step",
      resourceId: step._id,
      metadata: JSON.stringify({
        label: step.label,
        triggerValue: step.triggerValue,
      }),
    });
  },
});

type ScenarioActionInput = {
  actionType: "grant_access" | "alert_authority" | "account_wipe";
  targetContactId?: Id<"trusted_contacts">;
  config: string;
};

async function dispatchAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: ScenarioActionInput
) {
  switch (action.actionType) {
    case "alert_authority":
      await alertLegalAuthority(ctx, userId, action.targetContactId);
      return;
    case "account_wipe":
      await wipeUserData(ctx, userId, {
        actorType: "system",
        actorId: "scenario_engine",
      });
      return;
    case "grant_access":
      await ctx.scheduler.runAfter(0, internal.release.triggerRelease, {
        userId,
        reason: "scenario_step",
      });
      await createAuditLog(ctx, {
        userId,
        actorType: "system",
        actorId: "scenario_engine",
        action: "scenario_action_grant_access_dispatched",
        resourceType: "scenario_action",
        resourceId: action.actionType,
        metadata: action.config,
      });
      return;
  }
}

async function alertLegalAuthority(
  ctx: MutationCtx,
  userId: Id<"users">,
  targetContactId?: Id<"trusted_contacts">
) {
  let contact = null;
  if (targetContactId) {
    contact = await ctx.db.get(targetContactId);
  } else {
    const candidates = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    contact = candidates.find((c) => c.isLegalAuthority === true) ?? null;
  }
  if (!contact) {
    await createAuditLog(ctx, {
      userId,
      actorType: "system",
      actorId: "scenario_engine",
      action: "alert_authority_skipped_no_contact",
      resourceType: "scenario_action",
      resourceId: "alert_authority",
    });
    return;
  }

  if (contact.contactUserId) {
    await createNotification(ctx, {
      userId: contact.contactUserId,
      type: "security_alert",
      title: "Legal Authority activation",
      body: "You have been activated as a Legal Authority. Open Keeplas for next steps.",
      channels: ["push", "email"],
      actionUrl: "/trusted-contacts",
    });
  }

  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "scenario_engine",
    action: "legal_authority_alerted",
    resourceType: "trusted_contact",
    resourceId: contact._id,
  });
}

