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

// The hourly / weekly cron jobs must not run as one transaction over every
// account: past the Convex limits (16 MiB / 32k documents read, 1000
// scheduled functions per mutation) the whole run throws, rolls back, and
// throws again on every later tick, for every user. They now read one page
// per run and schedule the next one (finding gap20 / gap21 / gap22).

const DAY_MS = 24 * 60 * 60 * 1000;

type Channel = {
  type: "push" | "email" | "whatsapp";
  order: number;
  isEnabled: boolean;
};

const DEFAULT_CHANNELS: Channel[] = [
  { type: "push", order: 0, isEnabled: true },
  { type: "whatsapp", order: 1, isEnabled: true },
  { type: "email", order: 2, isEnabled: true },
];

/** Cursors of the batch continuations scheduled for `fn`. */
async function scheduledCursors(
  t: TestConvex,
  fn: string,
): Promise<(string | undefined)[]> {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs
      .filter((job) => job.name.includes(fn) && job.state.kind === "pending")
      .map((job) => (job.args[0] as { cursor?: string }).cursor);
  });
}

/**
 * Run a batch job like the cron does: first page, then each continuation it
 * schedules, until it stops rescheduling itself. Returns every run's result.
 */
async function runBatchJob<R>(
  t: TestConvex,
  fn: string,
  run: (cursor: string | undefined) => Promise<R>,
): Promise<R[]> {
  const results = [await run(undefined)];
  const seen = new Set<string>();
  for (;;) {
    const next = (await scheduledCursors(t, fn)).find(
      (c): c is string => c !== undefined && !seen.has(c),
    );
    if (next === undefined) return results;
    seen.add(next);
    results.push(await run(next));
  }
}

describe("life check evaluator (gap20)", () => {
  async function seedOverdueConfig(
    t: TestConvex,
    activeChannels: Channel[] = DEFAULT_CHANNELS,
  ) {
    const userId = await seedUser(t);
    const now = Date.now();
    const overdue = now - 60 * DAY_MS;
    await t.run((ctx) =>
      ctx.db.insert("life_check_configs", {
        userId,
        frequency: "monthly",
        inactivityThresholdDays: 30,
        lastActivityAt: overdue,
        activeChannels,
        travelModeEnabled: false,
        isActive: true,
        nextCheckAt: overdue + 30 * DAY_MS,
        createdAt: overdue,
        updatedAt: overdue,
      }),
    );
    return userId;
  }

  async function cycleCount(t: TestConvex) {
    return await t.run(
      async (ctx) => (await ctx.db.query("life_check_cycles").collect()).length,
    );
  }

  it("starts a cycle for every overdue account, one bounded page per run", async () => {
    const t = makeT({ enforceLimits: true });
    // 7 scheduled functions per start: 250 starts in one transaction would
    // blow the 1000 scheduled-function limit.
    for (let i = 0; i < 250; i++) await seedOverdueConfig(t);

    const results = await runBatchJob(t, "evaluateAllConfigs", (cursor) =>
      t.mutation(internal.life_check.evaluateAllConfigs, { cursor }),
    );

    expect(results.length).toBeGreaterThan(1);
    expect(results.reduce((sum, r) => sum + r.initiated, 0)).toBe(250);
    expect(await cycleCount(t)).toBe(250);
  });

  it("a re-run (overlapping tick) starts no second cycle", async () => {
    const t = makeT();
    await seedOverdueConfig(t);

    await t.mutation(internal.life_check.evaluateAllConfigs, {});
    const second = await t.mutation(internal.life_check.evaluateAllConfigs, {});

    expect(second.initiated).toBe(0);
    expect(await cycleCount(t)).toBe(1);
  });

  it("a legacy config with a huge channel list sends once per channel and blocks no one", async () => {
    const t = makeT({ enforceLimits: true });
    const legacy = await seedOverdueConfig(
      t,
      Array.from({ length: 1000 }, (_, order) => ({
        type: "push" as const,
        order,
        isEnabled: true,
      })),
    );
    const other = await seedOverdueConfig(t);

    await t.mutation(internal.life_check.evaluateAllConfigs, {});

    const cycles = await t.run((ctx) =>
      ctx.db.query("life_check_cycles").collect(),
    );
    expect(cycles.map((c) => c.userId).sort()).toEqual([legacy, other].sort());
    const legacyCycle = cycles.find((c) => c.userId === legacy)!;
    // 1 push send + 3 reminders + the Stage-2 handoff.
    expect(legacyCycle.pendingScheduleIds).toHaveLength(5);
  });

  it("saveConfig refuses more than one entry per channel", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await expect(
      asUser(t, owner).mutation(api.life_check.saveConfig, {
        frequency: "weekly",
        activeChannels: [
          { type: "push", order: 0, isEnabled: true },
          { type: "push", order: 1, isEnabled: true },
        ],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/channel/i);

    await asUser(t, owner).mutation(api.life_check.saveConfig, {
      frequency: "weekly",
      activeChannels: DEFAULT_CHANNELS,
      _audit: await signedAudit(),
    });
    const config = await t.run((ctx) =>
      ctx.db
        .query("life_check_configs")
        .withIndex("by_user", (q) => q.eq("userId", owner))
        .unique(),
    );
    expect(config?.activeChannels).toEqual(DEFAULT_CHANNELS);
  });
});

describe("scheduled releases (gap21)", () => {
  async function seedOwner(t: TestConvex) {
    const owner = await seedUser(t);
    const now = Date.now();
    const vaultId = await t.run((ctx) =>
      ctx.db.insert("vaults", {
        userId: owner,
        encryptedItemsCount: 0,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return { owner, vaultId };
  }

  async function seedDatedItem(
    t: TestConvex,
    owner: Id<"users">,
    vaultId: Id<"vaults">,
    releaseDate: number | undefined,
    encryptedContent = "ct",
  ): Promise<Id<"vault_items">> {
    const now = Date.now();
    return await t.run((ctx) =>
      ctx.db.insert("vault_items", {
        vaultId,
        userId: owner,
        encryptedContent,
        encryptionType: "zero_knowledge",
        accessLevel: "private",
        sharedWithContacts: [],
        status: "active",
        triggerType: "time_based",
        triggerConfig: { releaseDate },
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  it("future-dated letters are never read, however large", async () => {
    const t = makeT({ enforceLimits: true });
    const { owner, vaultId } = await seedOwner(t);
    // ~20 MiB of letters dated in the year 3000: more than one transaction
    // may read.
    const big = "x".repeat(1_000_000);
    for (let i = 0; i < 20; i++) {
      await seedDatedItem(t, owner, vaultId, 32503680000000, big);
    }
    const due = await seedDatedItem(t, owner, vaultId, Date.now() - 1000);

    await t.mutation(internal.release.processScheduledReleases, {});

    expect((await t.run((ctx) => ctx.db.get(due)))?.status).toBe("released");
  });

  it("releases every due letter across bounded pages", async () => {
    const t = makeT({ enforceLimits: true });
    const { owner, vaultId } = await seedOwner(t);
    // ~24 MiB of due letters: one page can't read them all.
    const big = "x".repeat(800_000);
    const ids: Id<"vault_items">[] = [];
    for (let i = 0; i < 30; i++) {
      ids.push(await seedDatedItem(t, owner, vaultId, Date.now() - 1000, big));
    }
    const undated = await seedDatedItem(t, owner, vaultId, undefined);

    const results = await runBatchJob(t, "processScheduledReleases", (cursor) =>
      t.mutation(internal.release.processScheduledReleases, { cursor }),
    );

    expect(results.length).toBeGreaterThan(1);
    // One read per transaction: the rows together exceed the read limit.
    for (const id of ids) {
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("released");
    }
    // An item with no date is never released (unchanged behaviour).
    expect((await t.run((ctx) => ctx.db.get(undated)))?.status).toBe("active");
  });
});

describe("trusted-contact reconfirm sweep (gap22)", () => {
  it("nudges every stale contact across bounded pages, once per run", async () => {
    const t = makeT({ enforceLimits: true });
    const owner = await seedUser(t);
    const longAgo = Date.now() - 90 * DAY_MS;
    // ~9 KB of published key material per accepted contact: 2,000 of them
    // are more than one transaction may read.
    const key = "k".repeat(9_000);
    const contactIds: Id<"trusted_contacts">[] = [];
    for (let i = 0; i < 2000; i++) {
      const contactUser = await seedUser(t);
      contactIds.push(
        await t.run((ctx) =>
          ctx.db.insert("trusted_contacts", {
            userId: owner,
            contactUserId: contactUser,
            name: `Contact ${i}`,
            email: `c${i}@example.com`,
            role: "family",
            contactPublicKeySignature: key,
            invitationStatus: "accepted",
            invitationToken: `tok-${i}`,
            invitedAt: longAgo,
            acceptedAt: longAgo,
            lastVerifiedAt: longAgo,
            createdAt: longAgo,
            updatedAt: longAgo,
          }),
        ),
      );
    }

    const results = await runBatchJob(t, "runAvailabilityReconfirm", (cursor) =>
      t.mutation(internal.trusted_contacts.runAvailabilityReconfirm, {
        cursor,
      }),
    );

    expect(results.length).toBeGreaterThan(1);
    // One read per transaction: the rows together exceed the read limit.
    for (const id of contactIds) {
      const row = await t.run((ctx) => ctx.db.get(id));
      expect(row?.reconfirmReminders).toBe(1);
    }
  });
});
