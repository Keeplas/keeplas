import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  internalAction,
  QueryCtx,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Dev / QA helpers to exercise the Life Check check-in and the full Escalation
 * Protocol WITHOUT waiting for the real timers (the 15-day check-in window, the
 * 7-day confirmation window and the 72-hour owner-cancel grace).
 *
 * These are internal functions — never exposed to clients. They are meant to be
 * invoked from the wrapper scripts via `npx convex run testing:<fn>`, which
 * always targets the dev deployment (never prod). Each step drives the SAME
 * production function the cron / webhooks call (life_check.initiateCycle,
 * enterConfirmationStage, releaseAfterConfirmation; release.triggerRelease), so
 * a green run means the real pipeline works.
 */

type Target = {
  userId: Id<"users">;
  email: string;
  name: string;
  phoneNumber: string | null;
  configId: Id<"life_check_configs">;
  frequency: "test" | "weekly" | "monthly" | "quarterly";
  isActive: boolean;
  whatsappEnabled: boolean;
  fallbackBehavior: "abort" | "release_anyway";
  trustContactId: Id<"trusted_contacts"> | null;
  trustContactCount: number;
  inFlightCycleId: Id<"life_check_cycles"> | null;
  inFlightStatus: string | null;
};

type StepLog = { step: string; detail: string };

type ForceResult = {
  ok: boolean;
  already: boolean;
  email: string;
  cycleId: Id<"life_check_cycles"> | null;
  status: string | null;
  // Outcome of the WhatsApp check-in leg. "sent" / "no_phone" /
  // "whatsapp_not_configured" / "error:..." when force-dispatched; "enabled (in
  // cycle fan-out)" when the cycle already sent it; null when not requested.
  whatsapp: string | null;
  message: string;
};

type EscalationResult = {
  ok: boolean;
  email: string;
  cycleId: Id<"life_check_cycles"> | null;
  steps: StepLog[];
  message: string;
};

/**
 * Resolve which user + Life Check config a test run acts on. With no email it
 * expects exactly one configured user (the typical dev case); otherwise it
 * refuses so the caller disambiguates with --email.
 */
async function loadTarget(ctx: QueryCtx, email?: string): Promise<Target> {
  let config;
  if (email) {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error(`No user with email ${email}`);
    config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!config) throw new Error(`User ${email} has no Life Check config`);
  } else {
    const configs = await ctx.db.query("life_check_configs").take(2);
    if (configs.length === 0) {
      throw new Error("No Life Check config exists on this deployment");
    }
    if (configs.length > 1) {
      throw new Error(
        "Multiple Life Check configs exist — pass --email=<user> to pick one",
      );
    }
    config = configs[0];
  }

  const user = await ctx.db.get(config.userId);
  if (!user) throw new Error("Config owner not found");

  const contacts = await ctx.db
    .query("trusted_contacts")
    .withIndex("by_user", (q) => q.eq("userId", config.userId))
    .collect();
  const trust = contacts.filter((c) => (c.contactType ?? "trust") === "trust");
  const acceptedTrust = trust.filter((c) => c.invitationStatus === "accepted");

  let inFlight = null;
  for (const status of ["running", "awaiting_confirmation"] as const) {
    inFlight = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", config.userId).eq("status", status),
      )
      .first();
    if (inFlight) break;
  }

  const whatsappEnabled = config.activeChannels.some(
    (c) => c.type === "whatsapp" && c.isEnabled,
  );

  return {
    userId: config.userId,
    email: user.email ?? "(no email)",
    name: user.name ?? "(unnamed)",
    phoneNumber: user.phoneNumber ?? null,
    configId: config._id,
    frequency: config.frequency,
    isActive: config.isActive,
    whatsappEnabled,
    fallbackBehavior: config.fallbackBehavior ?? "release_anyway",
    trustContactId: (acceptedTrust[0] ?? trust[0] ?? contacts[0])?._id ?? null,
    trustContactCount: acceptedTrust.length,
    inFlightCycleId: inFlight?._id ?? null,
    inFlightStatus: inFlight?.status ?? null,
  };
}

export const resolveTarget = internalQuery({
  args: { email: v.optional(v.string()) },
  handler: (ctx, args) => loadTarget(ctx, args.email),
});

/**
 * Simulate trusted contacts confirming the owner is unreachable: insert (or top
 * up) a pending access_request already at quorum. The real markUserUnreachable
 * is auth-gated to a contact's own session, so it can't be driven from a script
 * — this short-circuits to the same end state, skipping the 72h grace. The
 * caller fires releaseAfterConfirmation immediately afterwards.
 *
 * `gracePeriodEndsAt` is set to the PAST: a real quorum opens the 72h grace, and
 * the collapsed-timer tests want it already elapsed. This also lets the contact
 * recovery UI surface ("Submit my shard" requires a pending, quorum-reached
 * request whose grace has expired — see shared-vault-card.tsx) when seedQuorum
 * is used WITHOUT a following release (see seedRecoveryReady).
 */
export const seedQuorum = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (contacts.length === 0) {
      throw new Error(
        "Owner has no trusted contacts — cannot simulate the confirmation quorum",
      );
    }

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const threshold = config?.confirmationThreshold ?? 2;
    const initiated = contacts
      .slice(0, Math.max(threshold, 1))
      .map((c) => c._id);
    const now = Date.now();
    // 72h grace already elapsed (one second in the past).
    const gracePeriodEndsAt = now - 1000;

    const existing = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", args.userId).eq("status", "pending"),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contactsInitiated: initiated,
        quorumRequired: threshold,
        quorumReached: true,
        gracePeriodEndsAt,
        updatedAt: now,
      });
      return { requestId: existing._id };
    }

    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: args.userId,
      requestedBy: initiated[0],
      sectionsRequested: ["all"],
      status: "pending",
      autoResponseAt: now,
      quorumRequired: threshold,
      quorumReached: true,
      gracePeriodEndsAt,
      contactsInitiated: initiated,
      createdAt: now,
      updatedAt: now,
    });
    return { requestId };
  },
});

/**
 * Read back the WhatsApp attempt response recorded on a cycle, if any. The
 * dispatcher (dispatch.sendChannel) writes its outcome via recordChannelAttempt.
 */
async function lastWhatsAppResponse(
  ctx: QueryCtx,
  cycleId: Id<"life_check_cycles">,
): Promise<string | null> {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle) return null;
  const wa = [...cycle.channelsAttempted]
    .reverse()
    .find((a) => a.channelType === "whatsapp");
  return wa?.response ?? null;
}

export const readWhatsAppResponse = internalQuery({
  args: { cycleId: v.id("life_check_cycles") },
  handler: (ctx, args) => lastWhatsAppResponse(ctx, args.cycleId),
});

/**
 * Force a Life Check check-in to fire now (instead of waiting for the cadence).
 * Starts a real cycle via life_check.initiateCycle, which fans the check-in out
 * across every enabled channel (push / email / WhatsApp) and schedules the
 * reminders + handoff. Reuses an in-flight cycle rather than stacking a second.
 *
 * With `whatsapp: true` it also force-dispatches the WhatsApp template via the
 * real dispatcher (even when WhatsApp is NOT an enabled channel) and waits for
 * the Infobip result, so the WhatsApp leg is never silently skipped in a test.
 */
export const forceCheckIn = internalAction({
  args: { email: v.optional(v.string()), whatsapp: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ForceResult> => {
    const t: Target = await ctx.runQuery(internal.testing.resolveTarget, {
      email: args.email,
    });

    // Resolve the cycle to act on: reuse an in-flight one, else start a fresh one.
    let cycleId = t.inFlightCycleId;
    let already = true;
    if (!cycleId) {
      await ctx.runMutation(internal.life_check.initiateCycle, {
        configId: t.configId,
      });
      const after: Target = await ctx.runQuery(internal.testing.resolveTarget, {
        email: args.email,
      });
      cycleId = after.inFlightCycleId;
      already = false;
    }

    if (!cycleId) {
      return {
        ok: false,
        already: false,
        email: t.email,
        cycleId: null,
        status: null,
        whatsapp: null,
        message:
          "No cycle started: config is inactive, in travel mode, or has no enabled channel.",
      };
    }

    // WhatsApp leg. If it's already an enabled channel the cycle fan-out sent it;
    // otherwise force-dispatch it through the real dispatcher and await the
    // Infobip outcome so the test always exercises WhatsApp.
    let whatsapp: string | null = null;
    if (args.whatsapp) {
      if (t.whatsappEnabled && !already) {
        whatsapp = "enabled (in cycle fan-out)";
      } else {
        await ctx.runAction(internal.dispatch.sendChannel, {
          cycleId,
          channelType: "whatsapp",
        });
        whatsapp = await ctx.runQuery(internal.testing.readWhatsAppResponse, {
          cycleId,
        });
      }
    }

    return {
      ok: true,
      already,
      email: t.email,
      cycleId,
      status: already ? t.inFlightStatus : "running",
      whatsapp,
      message: already
        ? `A cycle was already in flight (${t.inFlightStatus}); reused it.`
        : "Check-in cycle started — enabled channels are being dispatched now.",
    };
  },
});

/**
 * Simulate the user confirming they're alive by REPLYING on WhatsApp — the
 * inbound leg of the dead-man's switch. Drives the real
 * life_check.validateFromWhatsApp (the Infobip inbound webhook's entry point),
 * resolved by the user's verified phone number. Resets the inactivity counter
 * and validates any in-flight cycle.
 */
export const confirmWhatsApp = internalAction({
  args: { email: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    matched: boolean;
    phoneNumber: string | null;
    email: string;
    message: string;
  }> => {
    const t: Target = await ctx.runQuery(internal.testing.resolveTarget, {
      email: args.email,
    });
    if (!t.phoneNumber) {
      return {
        matched: false,
        phoneNumber: null,
        email: t.email,
        message: "User has no phone number — cannot simulate a WhatsApp reply.",
      };
    }

    const res = await ctx.runMutation(
      internal.life_check.validateFromWhatsApp,
      {
        phoneNumber: t.phoneNumber,
      },
    );

    return {
      matched: res.matched,
      phoneNumber: t.phoneNumber,
      email: t.email,
      message: res.matched
        ? "WhatsApp reply accepted — inactivity counter reset, any in-flight cycle validated."
        : "No user matched that phone number (check the phoneNumber on the user).",
    };
  },
});

/**
 * Drive the FULL Escalation Protocol end-to-end with every timer collapsed:
 *   1. start a check-in cycle (if none in flight)
 *   2. hand off to the trusted-contact confirmation stage (Stage 2)
 *   3. simulate the contacts reaching the confirmation quorum
 *   4. skip the 72h grace and release the vault
 * Each step calls the same production function the scheduler would. When the
 * owner has no trusted contacts, Stage 2 can't be confirmed, so it resolves via
 * the owner's fallback policy instead. Returns a step-by-step log.
 *
 * WARNING: this fires a REAL release — recipients get an access_request and a
 * notification on this (dev) deployment.
 */
export const runEscalation = internalAction({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args): Promise<EscalationResult> => {
    const steps: StepLog[] = [];
    const t: Target = await ctx.runQuery(internal.testing.resolveTarget, {
      email: args.email,
    });

    // 1. Ensure a running cycle.
    let cycleId = t.inFlightCycleId;
    if (!cycleId) {
      await ctx.runMutation(internal.life_check.initiateCycle, {
        configId: t.configId,
      });
      const s: Target = await ctx.runQuery(internal.testing.resolveTarget, {
        email: args.email,
      });
      cycleId = s.inFlightCycleId;
      const wa = t.whatsappEnabled
        ? "WhatsApp is in the fan-out"
        : "WhatsApp NOT enabled — won't be sent";
      steps.push({
        step: "1. start",
        detail: cycleId
          ? `Cycle ${cycleId} started (${wa})`
          : "No cycle (config inactive / travel mode / no enabled channel)",
      });
    } else {
      steps.push({
        step: "1. start",
        detail: `Reusing in-flight cycle ${cycleId} (${t.inFlightStatus})`,
      });
    }

    if (!cycleId) {
      return {
        ok: false,
        email: t.email,
        cycleId: null,
        steps,
        message:
          "Could not start a cycle — is the config active with at least one enabled channel?",
      };
    }

    // 2. Stage 1 -> Stage 2: trusted-contact confirmation.
    await ctx.runMutation(internal.life_check.enterConfirmationStage, {
      cycleId,
    });
    steps.push({
      step: "2. confirmation_stage",
      detail: `Cycle -> awaiting_confirmation; ${t.trustContactCount} accepted trust contact(s) notified`,
    });

    // 3 + 4: reach the quorum and release, or fall back when there are no
    // contacts to confirm.
    if (t.trustContactId) {
      const { requestId }: { requestId: Id<"access_requests"> } =
        await ctx.runMutation(internal.testing.seedQuorum, {
          userId: t.userId,
        });
      steps.push({
        step: "3. quorum",
        detail: "Confirmation quorum reached (72h grace window skipped)",
      });
      await ctx.runMutation(internal.life_check.releaseAfterConfirmation, {
        userId: t.userId,
        requestId,
      });
      steps.push({
        step: "4. release",
        detail: "Cycle triggered — vault release fan-out scheduled",
      });
    } else {
      await ctx.runMutation(internal.life_check.resolveConfirmationWindow, {
        cycleId,
      });
      steps.push({
        step: "3. fallback",
        detail: `No trusted contacts — applied fallback policy "${t.fallbackBehavior}"`,
      });
    }

    return {
      ok: true,
      email: t.email,
      cycleId,
      steps,
      message:
        "Escalation Protocol executed. Run testing:summary (or check the dashboard) to see the result.",
    };
  },
});

/**
 * Park the system in the exact state the CONTACT recovery UI reads, so a trusted
 * contact can exercise "Submit my shard" -> "Reconstruct master key" in
 * /shared-with-me without waiting for the real windows:
 *   1. ensure a cycle in `awaiting_confirmation` (notifies the trust contacts)
 *   2. seed a PENDING, quorum-reached access_request whose 72h grace has already
 *      elapsed (seedQuorum)
 *
 * Unlike runEscalation it stops BEFORE the release, so the pending request the
 * UI depends on is left in place — getActiveAccessRequestForContact filters
 * status="pending", and shared-vault-card.tsx requires quorumReached + an
 * expired gracePeriodEndsAt to show the recovery section. runEscalation instead
 * drives all the way to `triggered`/`approved`, which closes that request.
 */
export const seedRecoveryReady = internalAction({
  args: { email: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    email: string;
    cycleId: Id<"life_check_cycles"> | null;
    requestId: Id<"access_requests"> | null;
    message: string;
  }> => {
    const t: Target = await ctx.runQuery(internal.testing.resolveTarget, {
      email: args.email,
    });
    if (!t.trustContactId) {
      throw new Error(
        "Owner has no trusted contacts — there is no one to recover the vault",
      );
    }

    // Ensure a cycle parked in awaiting_confirmation.
    let cycleId = t.inFlightCycleId;
    let status = t.inFlightStatus;
    if (!cycleId) {
      await ctx.runMutation(internal.life_check.initiateCycle, {
        configId: t.configId,
      });
      const s: Target = await ctx.runQuery(internal.testing.resolveTarget, {
        email: args.email,
      });
      cycleId = s.inFlightCycleId;
      status = s.inFlightStatus;
    }
    if (!cycleId) {
      return {
        ok: false,
        email: t.email,
        cycleId: null,
        requestId: null,
        message:
          "Could not start a cycle — config inactive, in travel mode, or no enabled channel.",
      };
    }
    if (status === "running") {
      await ctx.runMutation(internal.life_check.enterConfirmationStage, {
        cycleId,
      });
    }

    // Seed the pending quorum-reached request with the grace already expired.
    const { requestId }: { requestId: Id<"access_requests"> } =
      await ctx.runMutation(internal.testing.seedQuorum, { userId: t.userId });

    return {
      ok: true,
      email: t.email,
      cycleId,
      requestId,
      message:
        "Recovery-ready: cycle awaiting_confirmation + a pending, grace-expired access_request. " +
        "Each trust contact can now open /shared-with-me, Submit my shard, then Reconstruct master key.",
    };
  },
});

/**
 * Read-only snapshot of the user's Life Check + release state, for the wrapper
 * scripts to print after a run. Touches no state.
 */
export const summary = internalQuery({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const t = await loadTarget(ctx, args.email);

    const cycles = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_user", (q) => q.eq("userId", t.userId))
      .order("desc")
      .take(5);

    const requests = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", t.userId))
      .collect();
    const approved = requests.filter((r) => r.status === "approved");

    return {
      email: t.email,
      isActive: t.isActive,
      whatsappEnabled: t.whatsappEnabled,
      phoneNumber: t.phoneNumber,
      latestCycle: cycles[0]
        ? {
            status: cycles[0].status,
            startedAt: cycles[0].startedAt,
            channelsAttempted: cycles[0].channelsAttempted.map((a) => ({
              channel: a.channelType,
              response: a.response ?? null,
            })),
          }
        : null,
      recentCycleStatuses: cycles.map((c) => c.status),
      pendingAccessRequests: requests.filter((r) => r.status === "pending")
        .length,
      releasedToRecipients: new Set(approved.map((r) => r.requestedBy)).size,
    };
  },
});
