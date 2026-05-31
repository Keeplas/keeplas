import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

/**
 * These tests pin the OUTBOUND DELIVERY wiring of the escalation / 72h grace
 * protocol: the three points where a real email + WhatsApp must be scheduled
 * (createNotification is a deliberate no-op, so it cannot be the signal). We
 * assert on the pending `_scheduled_functions` rather than running the node
 * actions — convex-test leaves scheduled functions pending until finished.
 */

/** Names of pending scheduled functions whose path includes `needle`. */
async function pendingScheduled(
  t: TestConvex,
  needle: string,
): Promise<number> {
  const rows = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return rows.filter((r) => r.name.includes(needle)).length;
}

/** Seed a Life Check config and return its id. */
async function seedConfig(
  t: TestConvex,
  ownerId: Id<"users">,
  extra: Record<string, unknown> = {},
): Promise<Id<"life_check_configs">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("life_check_configs", {
      userId: ownerId,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
      ...extra,
    }),
  );
}

/** Seed a cycle in the given status for the owner. */
async function seedCycle(
  t: TestConvex,
  ownerId: Id<"users">,
  configId: Id<"life_check_configs">,
  status: "running" | "awaiting_confirmation",
): Promise<Id<"life_check_cycles">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("life_check_cycles", {
      userId: ownerId,
      configId,
      status,
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: now,
      startedAt: now,
    }),
  );
}

/** Seed an accepted trust contact, optionally bound to a contact user. */
async function seedContact(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: {
    shardIndex: number;
    contactUserId?: Id<"users">;
    contactType?: "trust" | "recipient_only";
    phoneNumber?: string;
  },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      contactUserId: opts.contactUserId,
      name: `Contact ${opts.shardIndex}`,
      email: `c${opts.shardIndex}@example.com`,
      phoneNumber: opts.phoneNumber,
      role: "family",
      contactType: opts.contactType ?? "trust",
      invitationStatus: "accepted",
      invitationToken: `tok-${opts.shardIndex}-${now}`,
      invitedAt: now,
      shardIndex: opts.shardIndex,
      contactPublicKey: "pk",
      shardConfirmed: true,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("enterConfirmationStage outbound delivery", () => {
  it("schedules notifyConfirmationRequest once per accepted trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const configId = await seedConfig(t, owner);
    const cycleId = await seedCycle(t, owner, configId, "running");

    const c1 = await seedUser(t);
    const c2 = await seedUser(t);
    await seedContact(t, owner, { shardIndex: 2, contactUserId: c1 });
    await seedContact(t, owner, { shardIndex: 3, contactUserId: c2 });
    // Skipped: recipient_only (not a trust contact)…
    const r = await seedUser(t);
    await seedContact(t, owner, {
      shardIndex: 4,
      contactUserId: r,
      contactType: "recipient_only",
    });
    // …and a trust contact with no account yet (no contactUserId).
    await seedContact(t, owner, { shardIndex: 5 });

    await t.mutation(internal.life_check.enterConfirmationStage, { cycleId });

    expect(await pendingScheduled(t, "notifyConfirmationRequest")).toBe(2);
  });
});

describe("markUserUnreachable quorum outbound delivery", () => {
  it("schedules the owner 72h grace alert and the release on quorum", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { name: "Ada", email: "ada@example.com" }),
    );
    // Threshold of 1 → a single confirmation reaches quorum.
    const configId = await seedConfig(t, owner, { confirmationThreshold: 1 });
    await seedCycle(t, owner, configId, "awaiting_confirmation");

    const contactUser = await seedUser(t);
    const contactId = await seedContact(t, owner, {
      shardIndex: 2,
      contactUserId: contactUser,
    });

    const result = await asUser(t, contactUser).mutation(
      api.access_requests.markUserUnreachable,
      { contactId, _audit: await signedAudit() },
    );

    expect(result.quorumReached).toBe(true);
    expect(await pendingScheduled(t, "notifyGraceCancel")).toBe(1);
    expect(await pendingScheduled(t, "releaseAfterConfirmation")).toBe(1);
  });
});

describe("fanOutRelease outbound delivery", () => {
  it("schedules notifyRelease once per recipient reached", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const now = Date.now();
    const vaultId = await t.run((ctx) =>
      ctx.db.insert("vaults", {
        userId: owner,
        encryptedItemsCount: 1,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("vault_items", {
        vaultId,
        userId: owner,
        category: "personal_document",
        title: "Will",
        encryptedContent: "ct",
        encryptionType: "zero_knowledge",
        accessLevel: "trusted_only",
        sharedWithContacts: [],
        recipientMode: "default",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    );

    const c1 = await seedUser(t);
    const c2 = await seedUser(t);
    await seedContact(t, owner, { shardIndex: 2, contactUserId: c1 });
    await seedContact(t, owner, { shardIndex: 3, contactUserId: c2 });

    await t.mutation(internal.release.triggerRelease, {
      userId: owner,
      reason: "test",
    });

    expect(await pendingScheduled(t, "notifyRelease")).toBe(2);
  });
});
