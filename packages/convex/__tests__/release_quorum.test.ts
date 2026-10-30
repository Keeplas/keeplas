import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import {
  asUser,
  makeT,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Stage-2 quorum state machine: who may count toward a release, and that a
// cycle always ends (released, or closed without release).

/** Owner with a threshold-2 config and a cycle parked at Stage 2. */
async function seedStage2(t: TestConvex) {
  const owner = await seedUser(t);
  const now = Date.now();
  const cycleId = await t.run(async (ctx) => {
    const configId = await ctx.db.insert("life_check_configs", {
      userId: owner,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now,
      confirmationThreshold: 2,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("life_check_cycles", {
      userId: owner,
      configId,
      status: "awaiting_confirmation",
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: now,
      startedAt: now,
    });
  });
  return { owner, cycleId };
}

/** An accepted contact backed by its own account. */
async function seedVoter(t: TestConvex, owner: Id<"users">, n: number) {
  const userId = await seedUser(t);
  const now = Date.now();
  const contactId = await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: owner,
      contactUserId: userId,
      name: `Contact ${n}`,
      email: `c${n}@example.com`,
      role: "family",
      invitationStatus: "accepted",
      invitationToken: `tok-${n}-${now}`,
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return { userId, contactId };
}

async function vote(
  t: TestConvex,
  voter: { userId: Id<"users">; contactId: Id<"trusted_contacts"> },
) {
  return await asUser(t, voter.userId).mutation(
    api.access_requests.markUserUnreachable,
    { contactId: voter.contactId, _audit: await signedAudit() },
  );
}

async function revoke(
  t: TestConvex,
  owner: Id<"users">,
  contactId: Id<"trusted_contacts">,
) {
  await asUser(t, owner).mutation(api.trusted_contacts.revokeContact, {
    contactId,
    _audit: await signedAudit(),
  });
}

async function scheduled(t: TestConvex, needle: string) {
  const rows = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return rows.filter((r) => r.name.includes(needle));
}

describe("a revoked contact's vote no longer counts (finding 8)", () => {
  it("does not reach quorum with a vote from a contact revoked since", async () => {
    const t = makeT();
    const { owner } = await seedStage2(t);
    const a = await seedVoter(t, owner, 1);
    const b = await seedVoter(t, owner, 2);

    await vote(t, a);
    await revoke(t, owner, a.contactId);
    const result = await vote(t, b);

    expect(result.quorumReached).toBe(false);
    expect(await scheduled(t, "releaseAfterConfirmation")).toHaveLength(0);
  });

  it("releases nothing when a voter is revoked during the grace", async () => {
    const t = makeT();
    const { owner, cycleId } = await seedStage2(t);
    const a = await seedVoter(t, owner, 1);
    const b = await seedVoter(t, owner, 2);
    await vote(t, a);
    const { requestId, quorumReached } = await vote(t, b);
    expect(quorumReached).toBe(true);

    await revoke(t, owner, a.contactId);
    await t.mutation(internal.life_check.releaseAfterConfirmation, {
      userId: owner,
      requestId: requestId as Id<"access_requests">,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("awaiting_confirmation");
    const request = await t.run((ctx) =>
      ctx.db.get(requestId as Id<"access_requests">),
    );
    // Back to collecting votes: a new quorum re-opens a fresh 72h grace.
    expect(request?.status).toBe("pending");
    expect(request?.quorumReached).toBe(false);
    expect(await scheduled(t, "triggerRelease")).toHaveLength(0);
  });
});

describe("the confirmation window always closes the cycle", () => {
  it("re-checks after the grace instead of leaving a quorum cycle unresolved", async () => {
    const t = makeT();
    const { owner, cycleId } = await seedStage2(t);
    const a = await seedVoter(t, owner, 1);
    const b = await seedVoter(t, owner, 2);
    await vote(t, a);
    const { requestId } = await vote(t, b);

    // Window ends while the release waits behind its grace.
    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });
    expect(await scheduled(t, "resolveConfirmationWindow")).toHaveLength(1);

    // The quorum fell apart during the grace, so the release did not fire.
    await revoke(t, owner, a.contactId);
    await t.mutation(internal.life_check.releaseAfterConfirmation, {
      userId: owner,
      requestId: requestId as Id<"access_requests">,
    });
    // The re-check closes the cycle without releasing anything.
    await t.mutation(internal.life_check.resolveConfirmationWindow, {
      cycleId,
    });

    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("cancelled");
    expect(cycle?.cancelledReason).toBe("no_contact_confirmation");
  });
});

describe("votes start a fresh request after an earlier release (finding 34)", () => {
  it("ignores a stale approved quorum row from a past cycle", async () => {
    const t = makeT();
    const { owner } = await seedStage2(t);
    const a = await seedVoter(t, owner, 1);
    const b = await seedVoter(t, owner, 2);
    // An earlier release the owner returned from without revoking.
    const now = Date.now();
    const stale = await t.run((ctx) =>
      ctx.db.insert("access_requests", {
        vaultUserId: owner,
        requestedBy: a.contactId,
        sectionsRequested: ["all"],
        status: "approved",
        autoResponseAt: now,
        quorumRequired: 2,
        quorumReached: true,
        contactsInitiated: [a.contactId, b.contactId],
        createdAt: now,
        updatedAt: now,
      }),
    );

    const first = await vote(t, a);
    const second = await vote(t, b);

    expect(first.requestId).not.toBe(stale);
    expect(second.requestId).toBe(first.requestId);
    expect(second.quorumReached).toBe(true);
    expect(await scheduled(t, "releaseAfterConfirmation")).toHaveLength(1);
  });
});
