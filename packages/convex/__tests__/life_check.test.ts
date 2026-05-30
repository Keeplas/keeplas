import { describe, it, expect } from "vitest";
import { internal } from "../_generated/api";
import { makeT, seedUser, type TestConvex } from "./test.helpers";
import type { Id } from "../_generated/dataModel";

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
