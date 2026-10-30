import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import {
  asUser,
  makeT,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed a Life Check config + an in-flight cycle parked at Stage-2
 * (`awaiting_confirmation`), so `resolveConfirmationWindow` runs its fallback
 * branch. `fallbackBehavior` is left unset unless explicitly provided, which is
 * the security-relevant case (finding H1).
 */
async function seedAwaitingConfirmation(
  t: TestConvex,
  ownerId: Id<"users">,
  fallbackBehavior?: "abort",
): Promise<Id<"life_check_cycles">> {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const configId = await ctx.db.insert("life_check_configs", {
      userId: ownerId,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now,
      ...(fallbackBehavior ? { fallbackBehavior } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("life_check_cycles", {
      userId: ownerId,
      configId,
      status: "awaiting_confirmation",
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: now,
      startedAt: now,
    });
  });
}

describe("resolveConfirmationWindow fallback (finding H1)", () => {
  it("does NOT release when no fallbackBehavior is configured (safe default = abort)", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner);

    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    // Abort: the vault stays locked, the cycle is cancelled — never triggered.
    expect(cycle?.status).toBe("cancelled");
    expect(cycle?.cancelledReason).toBe("no_contact_confirmation");
  });

  it("does NOT release with explicit fallbackBehavior = abort", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner, "abort");

    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("cancelled");
  });
});

describe("release_anyway is retired (F5)", () => {
  it("saveReleasePolicy always stores the abort fallback", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner);
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));

    await asUser(t, owner).mutation(api.life_check.saveReleasePolicy, {
      confirmationThreshold: 2,
      confirmationWindowDays: 7,
      _audit: await signedAudit(),
    });

    const config = await t.run((ctx) => ctx.db.get(cycle!.configId));
    expect(config?.fallbackBehavior).toBe("abort");
  });

  it("the schema refuses a release_anyway fallback", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner);
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));

    await expect(
      t.run((ctx) =>
        ctx.db.patch(cycle!.configId, {
          fallbackBehavior: "release_anyway",
        } as never),
      ),
    ).rejects.toThrow();
  });
});

/** Insert a Life Check config for `owner`, overridable per test. */
async function seedConfig(
  t: TestConvex,
  ownerId: Id<"users">,
  overrides: Partial<{
    isActive: boolean;
    lastActivityAt: number;
    nextCheckAt: number;
    travelModeEnabled: boolean;
    travelModeUntil: number;
    activeChannels: {
      type: "push" | "email" | "whatsapp";
      order: number;
      isEnabled: boolean;
    }[];
  }> = {},
): Promise<Id<"life_check_configs">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("life_check_configs", {
      userId: ownerId,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      lastActivityAt: now,
      nextCheckAt: now + 30 * DAY_MS,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }),
  );
}

/** Insert a `running` cycle for `owner`. */
async function seedRunningCycle(
  t: TestConvex,
  ownerId: Id<"users">,
  configId: Id<"life_check_configs">,
): Promise<Id<"life_check_cycles">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("life_check_cycles", {
      userId: ownerId,
      configId,
      status: "running",
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: now,
      startedAt: now,
    }),
  );
}

/** How many cycles exist for `owner` (used to assert "no cycle started"). */
async function countCycles(
  t: TestConvex,
  ownerId: Id<"users">,
): Promise<number> {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_user", (q) => q.eq("userId", ownerId))
      .collect();
    return rows.length;
  });
}

describe("pause / travel mode suspend in-flight work and reset the counter", () => {
  it("pause cancels an in-flight cycle and denies pending access requests", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedConfig(t, owner);
    const cycleId = await seedRunningCycle(t, owner, configId);

    // A Stage-2 trusted-contact confirmation is already pending.
    const contactId = await seedTrustContact(t, owner, { n: 0 });
    const now = Date.now();
    const reqId = await t.run((ctx) =>
      ctx.db.insert("access_requests", {
        vaultUserId: owner,
        requestedBy: contactId,
        sectionsRequested: [],
        status: "pending",
        autoResponseAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await asUser(t, owner).mutation(api.life_check.toggleActive, {
      isActive: false,
      _audit: await signedAudit(),
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("cancelled");
    expect(cycle?.cancelledReason).toBe("paused");

    const req = await t.run((ctx) => ctx.db.get(reqId));
    expect(req?.status).toBe("denied");

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.isActive).toBe(false);
  });

  it("enabling travel mode cancels an in-flight cycle", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedConfig(t, owner);
    const cycleId = await seedRunningCycle(t, owner, configId);

    await asUser(t, owner).mutation(api.life_check.toggleTravelMode, {
      enabled: true,
      until: Date.now() + 10 * DAY_MS,
      _audit: await signedAudit(),
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("cancelled");
    expect(cycle?.cancelledReason).toBe("travel_mode");

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.travelModeEnabled).toBe(true);
  });

  it("resuming after a pause resets the counter — no immediate cycle", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    // Paused config whose clock is long overdue.
    const overdue = Date.now() - 60 * DAY_MS;
    const configId = await seedConfig(t, owner, {
      isActive: false,
      lastActivityAt: overdue,
      nextCheckAt: overdue + 30 * DAY_MS,
    });

    await asUser(t, owner).mutation(api.life_check.toggleActive, {
      isActive: true,
      _audit: await signedAudit(),
    });

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.isActive).toBe(true);
    // Clock restarted to a full fresh window.
    expect(config!.lastActivityAt!).toBeGreaterThan(overdue);
    expect(config!.nextCheckAt).toBeGreaterThan(Date.now() + 29 * DAY_MS);

    // The evaluator must NOT start a cycle right after resume.
    await t.mutation(internal.life_check.evaluateAllConfigs, {});
    expect(await countCycles(t, owner)).toBe(0);
  });

  it("travel-mode expiry resets the counter — no immediate cycle", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const overdue = Date.now() - 60 * DAY_MS;
    const configId = await seedConfig(t, owner, {
      lastActivityAt: overdue,
      nextCheckAt: overdue + 30 * DAY_MS,
      travelModeEnabled: true,
      travelModeUntil: Date.now() - 1000, // already expired
    });

    await t.mutation(internal.life_check.evaluateAllConfigs, {});

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.travelModeEnabled).toBe(false);
    expect(config?.travelModeUntil).toBeUndefined();
    expect(config!.lastActivityAt!).toBeGreaterThan(overdue);
    expect(await countCycles(t, owner)).toBe(0);
  });

  it("pausing with no cycle in flight is a clean no-op", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedConfig(t, owner);

    await asUser(t, owner).mutation(api.life_check.toggleActive, {
      isActive: false,
      _audit: await signedAudit(),
    });

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.isActive).toBe(false);
    expect(await countCycles(t, owner)).toBe(0);
  });
});

describe("LIFE_CHECK_PAUSED kill switch freezes the counting", () => {
  beforeEach(() => {
    process.env.LIFE_CHECK_PAUSED = "true";
  });
  afterEach(() => {
    delete process.env.LIFE_CHECK_PAUSED;
  });

  it("evaluator starts no cycle for an overdue config while paused", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const overdue = Date.now() - 60 * DAY_MS;
    await seedConfig(t, owner, {
      lastActivityAt: overdue,
      nextCheckAt: overdue + 30 * DAY_MS,
    });

    const result = await t.mutation(internal.life_check.evaluateAllConfigs, {});

    expect(result).toEqual({ evaluated: 0, initiated: 0 });
    expect(await countCycles(t, owner)).toBe(0);
  });

  it("enterConfirmationStage defers instead of escalating while paused", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedConfig(t, owner);
    const cycleId = await seedRunningCycle(t, owner, configId);

    await t.mutation(internal.life_check.enterConfirmationStage, { cycleId });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    // Still Stage-1, with a re-check scheduled so it resumes once unpaused.
    expect(cycle?.status).toBe("running");
    expect(cycle?.pendingScheduleIds).toHaveLength(1);
  });

  it("resolveConfirmationWindow defers instead of resolving while paused", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner);

    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("awaiting_confirmation");
    expect(cycle?.pendingScheduleIds).toHaveLength(1);
  });

  it("getConfig reports the pause so the UI can freeze the countdown", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedConfig(t, owner);

    const config = await asUser(t, owner).query(api.life_check.getConfig, {});
    expect(config?.paused).toBe(true);
  });
});

describe("I'm okay", () => {
  it("resets the countdown and returns the next check date", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedAwaitingConfirmation(t, owner);

    const result = await asUser(t, owner).mutation(
      api.life_check.validateCycle,
      { method: "tap", _audit: await signedAudit() },
    );

    const config = await asUser(t, owner).query(api.life_check.getConfig, {});
    expect(config?.lastCheckAt).toBeTypeOf("number");
    expect(result.nextCheckAt).toBe(config?.nextCheckAt);
    expect(result.nextCheckAt).toBeGreaterThan(Date.now() + DAY_MS);
  });

  it("cancels emergency access in its 72h grace window", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedAwaitingConfirmation(t, owner);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    const requestId = await seedAccessRequest(t, owner, contactId, "pending", {
      quorumReached: true,
      gracePeriodEndsAt: Date.now() + 72 * 60 * 60 * 1000,
    });

    await asUser(t, owner).mutation(api.life_check.validateCycle, {
      method: "tap",
      _audit: await signedAudit(),
    });

    const request = await t.run((ctx) => ctx.db.get(requestId));
    expect(request?.status).toBe("denied");
    expect(request?.cancelledDuringGrace).toBe(true);
  });
});

/** Insert an access request for `owner`'s vault, overridable per test. */
async function seedAccessRequest(
  t: TestConvex,
  ownerId: Id<"users">,
  contactId: Id<"trusted_contacts">,
  status: "pending" | "approved",
  extra: Partial<{
    sectionsRequested: string[];
    quorumReached: boolean;
    gracePeriodEndsAt: number;
  }> = {},
): Promise<Id<"access_requests">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("access_requests", {
      vaultUserId: ownerId,
      requestedBy: contactId,
      sectionsRequested: ["all"],
      status,
      autoResponseAt: now,
      contactsInitiated: [contactId],
      createdAt: now,
      updatedAt: now,
      ...extra,
    }),
  );
}

describe("no Life check loop after a release (post-release-life-check-loop)", () => {
  const PUSH_ON = [{ type: "push" as const, order: 0, isEnabled: true }];

  /** An overdue config with push on: the evaluator would start a cycle. */
  async function seedOverdueConfig(t: TestConvex, owner: Id<"users">) {
    const overdue = Date.now() - 60 * DAY_MS;
    return await seedConfig(t, owner, {
      activeChannels: PUSH_ON,
      lastActivityAt: overdue,
      nextCheckAt: overdue + 30 * DAY_MS,
    });
  }

  it("control: an overdue config with no release starts a cycle", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedOverdueConfig(t, owner);

    const result = await t.mutation(internal.life_check.evaluateAllConfigs, {});

    expect(result.initiated).toBe(1);
  });

  it("the evaluator starts no new cycle once the quorum release fired", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedOverdueConfig(t, owner);
    const cycleId = await t.run((ctx) =>
      ctx.db.insert("life_check_cycles", {
        userId: owner,
        configId,
        status: "awaiting_confirmation",
        channelsAttempted: [],
        pendingScheduleIds: [],
        scheduledAt: Date.now(),
        startedAt: Date.now(),
      }),
    );
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    const requestId = await seedAccessRequest(t, owner, contactId, "pending", {
      quorumReached: true,
    });

    // The 72h grace ends: the request is approved and the cycle triggered.
    await t.mutation(internal.life_check.releaseAfterConfirmation, {
      userId: owner,
      requestId,
    });
    expect((await t.run((ctx) => ctx.db.get(cycleId)))?.status).toBe(
      "triggered",
    );

    const result = await t.mutation(internal.life_check.evaluateAllConfigs, {});

    expect(result.initiated).toBe(0);
    expect(await countCycles(t, owner)).toBe(1);
  });

  it("legacy account already looping: the running cycle never asks contacts again", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedOverdueConfig(t, owner);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    // Shipped state before the fix: an old triggered cycle, its release in
    // force, and a new cycle the evaluator restarted after the release.
    await t.run(async (ctx) => {
      await ctx.db.insert("life_check_cycles", {
        userId: owner,
        configId,
        status: "triggered",
        channelsAttempted: [],
        pendingScheduleIds: [],
        scheduledAt: Date.now() - 40 * DAY_MS,
        startedAt: Date.now() - 40 * DAY_MS,
        completedAt: Date.now() - 30 * DAY_MS,
      });
    });
    await seedAccessRequest(t, owner, contactId, "approved", {
      sectionsRequested: ["item:abc"],
    });
    const loopCycleId = await seedRunningCycle(t, owner, configId);

    await t.mutation(internal.life_check.enterConfirmationStage, {
      cycleId: loopCycleId,
    });

    const loopCycle = await t.run((ctx) => ctx.db.get(loopCycleId));
    expect(loopCycle?.status).toBe("cancelled");
    expect(loopCycle?.cancelledReason).toBe("release_in_force");
    const asked = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter(
        (r) => r.name.includes("notifyConfirmationRequest"),
      ),
    );
    expect(asked).toHaveLength(0);

    const result = await t.mutation(internal.life_check.evaluateAllConfigs, {});
    expect(result.initiated).toBe(0);
  });

  it("revoking the release re-arms the Life check with a fresh window", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedOverdueConfig(t, owner);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    await seedAccessRequest(t, owner, contactId, "approved", {
      sectionsRequested: ["item:abc"],
    });

    await asUser(t, owner).mutation(api.access_requests.revokeReleasedAccess, {
      _audit: await signedAudit(),
    });

    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config!.lastActivityAt!).toBeGreaterThan(Date.now() - DAY_MS);
    expect(config!.nextCheckAt).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    // No stale-clock cycle right after the owner came back.
    const result = await t.mutation(internal.life_check.evaluateAllConfigs, {});
    expect(result.initiated).toBe(0);
  });
});

describe("migrations.enableLifeCheckPush", () => {
  async function seedConfig(
    t: TestConvex,
    activeChannels: {
      type: "push" | "email" | "whatsapp";
      order: number;
      isEnabled: boolean;
    }[],
  ) {
    const userId = await seedUser(t);
    const now = Date.now();
    return await t.run((ctx) =>
      ctx.db.insert("life_check_configs", {
        userId,
        frequency: "monthly",
        activeChannels,
        travelModeEnabled: false,
        isActive: true,
        nextCheckAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  it("turns push on for configs the web saved with push forced off", async () => {
    const t = makeT();
    // Legacy web shape: push marked "coming soon" and persisted disabled.
    const legacy = await seedConfig(t, [
      { type: "whatsapp", order: 1, isEnabled: true },
      { type: "push", order: 2, isEnabled: false },
      { type: "email", order: 3, isEnabled: false },
    ]);
    const missing = await seedConfig(t, [
      { type: "email", order: 1, isEnabled: true },
    ]);
    const already = await seedConfig(t, [
      { type: "push", order: 0, isEnabled: true },
    ]);

    expect(
      await t.mutation(internal.migrations.enableLifeCheckPush, {}),
    ).toEqual({ scanned: 3, migrated: 2 });

    const channels = async (id: Id<"life_check_configs">) =>
      (await t.run((ctx) => ctx.db.get(id)))!.activeChannels;
    expect(await channels(legacy)).toEqual([
      { type: "whatsapp", order: 1, isEnabled: true },
      { type: "push", order: 2, isEnabled: true },
      // Other channels keep the user's choice.
      { type: "email", order: 3, isEnabled: false },
    ]);
    expect(await channels(missing)).toEqual([
      { type: "email", order: 1, isEnabled: true },
      { type: "push", order: 2, isEnabled: true },
    ]);
    expect(await channels(already)).toEqual([
      { type: "push", order: 0, isEnabled: true },
    ]);

    // Idempotent.
    expect(
      await t.mutation(internal.migrations.enableLifeCheckPush, {}),
    ).toEqual({ scanned: 3, migrated: 0 });
  });
});
