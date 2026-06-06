import { describe, it, expect } from "vitest";
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
  fallbackBehavior?: "abort" | "release_anyway",
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

  it("DOES release only on explicit owner opt-in (release_anyway)", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const cycleId = await seedAwaitingConfirmation(t, owner, "release_anyway");

    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    // release_anyway hands off to the release fan-out via markCycleTriggered.
    expect(cycle?.status).toBe("triggered");
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
    const contactId = await seedTrustContact(t, owner, { shardIndex: 0 });
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
