import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, type TestConvex } from "./test.helpers";
import type { Id } from "../_generated/dataModel";
import { signLifeCheckToken } from "../lib/life_check_token";

// Finding 30: the one-click "I'm well" email link answers ONE Stage-1
// check-in. It must not reset the clock from an old cycle, nor cancel a
// Stage-2 confirmation (that needs the owner signed in, step-up gated).

const DAY_MS = 24 * 60 * 60 * 1000;

async function seed(
  t: TestConvex,
  status: "running" | "awaiting_confirmation" | "validated",
) {
  const owner = await seedUser(t);
  const lastActivityAt = Date.now() - 40 * DAY_MS;
  const ids = await t.run(async (ctx) => {
    const configId = await ctx.db.insert("life_check_configs", {
      userId: owner,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      lastActivityAt,
      nextCheckAt: lastActivityAt + 30 * DAY_MS,
      createdAt: lastActivityAt,
      updatedAt: lastActivityAt,
    });
    const cycleId = await ctx.db.insert("life_check_cycles", {
      userId: owner,
      configId,
      status,
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: lastActivityAt,
      startedAt: lastActivityAt,
    });
    return { configId, cycleId };
  });
  return { owner, lastActivityAt, ...ids };
}

async function tokenFor(owner: Id<"users">, cycleId: Id<"life_check_cycles">) {
  return await signLifeCheckToken({
    cycleId,
    userId: owner,
    exp: Date.now() + 10 * DAY_MS,
  });
}

describe("one-click email confirmation", () => {
  it("validates the running check-in it was sent for", async () => {
    const t = makeT();
    const { owner, cycleId } = await seed(t, "running");

    const result = await t.action(api.life_check.confirmFromEmailToken, {
      token: await tokenFor(owner, cycleId),
    });

    expect(result).toBe("ok");
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("validated");
  });

  it("does not cancel a Stage-2 confirmation", async () => {
    const t = makeT();
    const { owner, cycleId, configId, lastActivityAt } = await seed(
      t,
      "awaiting_confirmation",
    );
    const contactId = await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Contact",
        email: "c@example.com",
        role: "family",
        invitationStatus: "accepted",
        invitationToken: "tok-stage2",
        invitedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const requestId = await t.run((ctx) =>
      ctx.db.insert("access_requests", {
        vaultUserId: owner,
        requestedBy: contactId,
        sectionsRequested: ["all"],
        status: "pending",
        autoResponseAt: Date.now(),
        quorumReached: true,
        contactsInitiated: [contactId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const result = await t.action(api.life_check.confirmFromEmailToken, {
      token: await tokenFor(owner, cycleId),
    });

    expect(result).toBe("invalid");
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("awaiting_confirmation");
    const request = await t.run((ctx) => ctx.db.get(requestId));
    expect(request?.status).toBe("pending");
    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.lastActivityAt).toBe(lastActivityAt);
  });

  it("is spent once its check-in is answered: a replay changes nothing", async () => {
    const t = makeT();
    const { owner, cycleId, configId, lastActivityAt } = await seed(
      t,
      "validated",
    );
    // A later check-in is now running; the old link must not answer it.
    const current = await t.run((ctx) =>
      ctx.db.insert("life_check_cycles", {
        userId: owner,
        configId,
        status: "running",
        channelsAttempted: [],
        pendingScheduleIds: [],
        scheduledAt: Date.now(),
        startedAt: Date.now(),
      }),
    );

    const result = await t.action(api.life_check.confirmFromEmailToken, {
      token: await tokenFor(owner, cycleId),
    });

    // Already confirmed: the page can say so, but nothing moves.
    expect(result).toBe("ok");
    const running = await t.run((ctx) => ctx.db.get(current));
    expect(running?.status).toBe("running");
    const config = await t.run((ctx) => ctx.db.get(configId));
    expect(config?.lastActivityAt).toBe(lastActivityAt);
  });

  it("rejects a tampered token", async () => {
    const t = makeT();
    const { owner, cycleId } = await seed(t, "running");
    const token = await tokenFor(owner, cycleId);

    const result = await t.action(api.life_check.confirmFromEmailToken, {
      token: `${token.slice(0, -2)}xx`,
    });

    expect(result).toBe("invalid");
  });
});
