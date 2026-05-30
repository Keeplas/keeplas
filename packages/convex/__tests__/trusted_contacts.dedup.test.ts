import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

/** Insert a user with a verified email and/or phone. */
async function seedVerifiedUser(
  t: TestConvex,
  opts: { email?: string; phoneNumber?: string },
): Promise<Id<"users">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      email: opts.email,
      emailVerificationTime: opts.email ? now : undefined,
      phoneNumber: opts.phoneNumber,
      phoneNumberVerifiedAt: opts.phoneNumber ? now : undefined,
    }),
  );
}

/**
 * Open an awaiting_confirmation life-check cycle (with its config) so
 * `markUserUnreachable`'s escalation gate is satisfied. Shape mirrors the
 * seed used in life_check.test.ts.
 */
async function seedAwaitingConfirmation(t: TestConvex, ownerId: Id<"users">) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const configId = await ctx.db.insert("life_check_configs", {
      userId: ownerId,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("life_check_cycles", {
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

describe("C1 — quorum dedups by distinct human", () => {
  it("two rows backed by the same person do NOT reach quorum alone", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    // One human, invited (and accepted) twice — e.g. once by email, once by
    // phone — so two rows share the same contactUserId.
    const personUser = await seedUser(t);
    const rowA = await seedTrustContact(t, owner, { shardIndex: 2 });
    const rowB = await seedTrustContact(t, owner, { shardIndex: 3 });
    await t.run((ctx) => ctx.db.patch(rowA, { contactUserId: personUser }));
    await t.run((ctx) => ctx.db.patch(rowB, { contactUserId: personUser }));
    await seedAwaitingConfirmation(t, owner);

    const r1 = await asUser(t, personUser).mutation(
      api.access_requests.markUserUnreachable,
      { contactId: rowA, _audit: await signedAudit() },
    );
    expect(r1.quorumReached).toBe(false);

    // Same person voting through their second row must NOT tip the quorum.
    const r2 = await asUser(t, personUser).mutation(
      api.access_requests.markUserUnreachable,
      { contactId: rowB, _audit: await signedAudit() },
    );
    expect(r2.quorumReached).toBe(false);
  });
});

describe("C1 — one person contributes at most one shard", () => {
  it("rejects a second shard submission from the same human", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const personUser = await seedUser(t);
    const rowA = await seedTrustContact(t, owner, { shardIndex: 2 });
    const rowB = await seedTrustContact(t, owner, { shardIndex: 3 });
    await t.run((ctx) => ctx.db.patch(rowA, { contactUserId: personUser }));
    await t.run((ctx) => ctx.db.patch(rowB, { contactUserId: personUser }));
    // A distinct third person, so the first submission has a valid fan-out
    // recipient and actually writes a submission row to dedup against.
    const otherUser = await seedUser(t);
    const rowC = await seedTrustContact(t, owner, { shardIndex: 4 });
    await t.run((ctx) => ctx.db.patch(rowC, { contactUserId: otherUser }));

    const now = Date.now();
    const requestId = await t.run((ctx) =>
      ctx.db.insert("access_requests", {
        vaultUserId: owner,
        requestedBy: rowA,
        sectionsRequested: ["all"],
        status: "pending",
        autoResponseAt: now,
        quorumRequired: 2,
        quorumReached: true,
        gracePeriodEndsAt: now - 1000, // grace already expired
        contactsInitiated: [rowA],
        createdAt: now,
        updatedAt: now,
      }),
    );

    // First submission via row A fans out to the distinct third person.
    const first = await asUser(t, personUser).mutation(
      api.access_requests.submitRecoveryShards,
      {
        accessRequestId: requestId,
        submitterContactId: rowA,
        submissions: [{ recipientContactId: rowC, wrappedShard: "envelope" }],
        _audit: await signedAudit(),
      },
    );
    expect(first.submitted).toBe(1);

    // Second submission via the SAME person's other row must be rejected.
    await expect(
      asUser(t, personUser).mutation(api.access_requests.submitRecoveryShards, {
        accessRequestId: requestId,
        submitterContactId: rowB,
        submissions: [{ recipientContactId: rowC, wrappedShard: "envelope" }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already been submitted/);
  });
});

describe("#5 — acceptInvitation binds to the invited recipient", () => {
  it("rejects an account whose verified email/phone != invited channel", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const token = "tok-bind-mismatch";
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Invited Person",
        email: "invited@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "pending",
        invitationToken: token,
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    // Attacker holds a leaked token but their verified email is different.
    const attacker = await seedVerifiedUser(t, {
      email: "attacker@example.com",
    });

    await expect(
      asUser(t, attacker).mutation(api.trusted_contacts.acceptInvitation, {
        token,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/different email or phone number/);
  });

  it("accepts when the verified email matches the invited channel", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const token = "tok-bind-match";
    const now = Date.now();
    const contactId = await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Invited Person",
        email: "invited@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "pending",
        invitationToken: token,
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const invitee = await seedVerifiedUser(t, {
      email: "invited@example.com",
    });

    const res = await asUser(t, invitee).mutation(
      api.trusted_contacts.acceptInvitation,
      { token, _audit: await signedAudit() },
    );
    expect(res.success).toBe(true);

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.contactUserId).toBe(invitee);
  });

  it("rejects attaching a contactUserId already backing another row", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    // The invitee already accepted a first invitation (row A) for this owner.
    const invitee = await seedVerifiedUser(t, {
      email: "person@example.com",
      phoneNumber: "+14155550100",
    });
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Person (email)",
        email: "person@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "accepted",
        invitationToken: "tok-existing",
        invitedAt: now,
        contactUserId: invitee,
        createdAt: now,
        updatedAt: now,
      }),
    );

    // A second pending invite to the SAME person via their phone channel.
    const token = "tok-second-channel";
    await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Person (phone)",
        phoneNumber: "+14155550100",
        role: "family",
        contactType: "trust",
        invitationStatus: "pending",
        invitationToken: token,
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await expect(
      asUser(t, invitee).mutation(api.trusted_contacts.acceptInvitation, {
        token,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already a contact/);
  });
});

describe("C1 — inviteContact dedups by distinct human", () => {
  it("rejects inviting a person who already backs a non-revoked row", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const person = await seedVerifiedUser(t, {
      email: "dup@example.com",
      phoneNumber: "+14155550199",
    });
    const now = Date.now();
    // Existing accepted row for this person, attached via email channel.
    await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        name: "Dup (email)",
        email: "dup@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "accepted",
        invitationToken: "tok-dup",
        invitedAt: now,
        contactUserId: person,
        createdAt: now,
        updatedAt: now,
      }),
    );

    // Re-invite the same human via their (different) phone channel.
    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.inviteContact, {
        name: "Dup (phone)",
        phoneNumber: "+14155550199",
        role: "family",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already one of your contacts/);
  });
});
