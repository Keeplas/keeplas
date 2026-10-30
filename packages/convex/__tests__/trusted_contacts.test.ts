import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

describe("contact names", () => {
  it("caps the name on invite and on edit", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const long = "y".repeat(10_000);
    const { contactId } = await asUser(t, owner).mutation(
      api.trusted_contacts.inviteContact,
      {
        name: long,
        email: "c@example.com",
        role: "friend",
        _audit: await signedAudit(),
      },
    );
    expect((await t.run((ctx) => ctx.db.get(contactId)))?.name).toHaveLength(
      100,
    );

    await asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
      contactId,
      name: `z${long}`,
      email: "c@example.com",
      _audit: await signedAudit(),
    });
    expect((await t.run((ctx) => ctx.db.get(contactId)))?.name).toBe(
      `z${long}`.slice(0, 100),
    );
  });
});

describe("confirmAvailability", () => {
  it("stamps lastVerifiedAt for an accepted trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    // Link the row to the accepting contact's account so they can authenticate.
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );

    const result = await asUser(t, contactUser).mutation(
      api.trusted_contacts.confirmAvailability,
      { contactId, _audit: await signedAudit() },
    );
    expect(result).toEqual({ success: true });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.lastVerifiedAt).toBeTypeOf("number");
  });
});

describe("inviteContact", () => {
  it("invites any number of contacts, all as trust contacts", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    const ids = [];
    for (const n of [1, 2, 3, 4]) {
      const { contactId } = await asUser(t, owner).mutation(
        api.trusted_contacts.inviteContact,
        {
          name: `Contact ${n}`,
          email: `c${n}@example.com`,
          role: "friend",
          _audit: await signedAudit(),
        },
      );
      ids.push(contactId);
    }

    const rows = await t.run((ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id))),
    );
    expect(rows.map((row) => row?.contactType)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("refuses the owner's own phone number or email", async () => {
    const t = makeT();
    const owner = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "me@example.com",
        phoneNumber: "+33612345678",
        phoneNumberVerifiedAt: Date.now(),
      }),
    );

    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.inviteContact, {
        name: "Me",
        phoneNumber: "+33612345678",
        role: "friend",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/yourself/);
    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.inviteContact, {
        name: "Me",
        email: " Me@Example.com ",
        role: "friend",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/yourself/);
  });

  it("refuses editing a contact to the owner's own number", async () => {
    const t = makeT();
    const owner = await t.run((ctx) =>
      ctx.db.insert("users", { phoneNumber: "+33612345678" }),
    );
    const contactId = await seedTrustContact(t, owner, { n: 1 });

    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
        contactId,
        name: "Contact 1",
        phoneNumber: "+33612345678",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/yourself/);
  });
});

describe("invitation rate limit", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function invite(t: ReturnType<typeof makeT>, owner: Id<"users">) {
    const { contactId } = await asUser(t, owner).mutation(
      api.trusted_contacts.inviteContact,
      {
        name: "Ada",
        phoneNumber: "+33612345678",
        role: "friend",
        _audit: await signedAudit(),
      },
    );
    return contactId;
  }

  async function resend(
    t: ReturnType<typeof makeT>,
    owner: Id<"users">,
    contactId: Id<"trusted_contacts">,
  ) {
    return asUser(t, owner).mutation(api.trusted_contacts.resendInvitation, {
      contactId,
      _audit: await signedAudit(),
    });
  }

  it("sends one person at most 3 invitations a day", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await invite(t, owner);
    await resend(t, owner, contactId);
    await resend(t, owner, contactId);

    await expect(resend(t, owner, contactId)).rejects.toThrow(
      /Too many invitations/,
    );

    vi.setSystemTime(Date.now() + DAY_MS + 1);
    await expect(resend(t, owner, contactId)).resolves.toBeDefined();
  });

  it("counts invitations sent again after removing the person", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    for (let sent = 0; sent < 3; sent++) {
      const contactId = await invite(t, owner);
      await asUser(t, owner).mutation(api.trusted_contacts.revokeContact, {
        contactId,
        _audit: await signedAudit(),
      });
    }

    await expect(invite(t, owner)).rejects.toThrow(/Too many invitations/);
  });

  it("limits each owner separately", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const other = await seedUser(t);
    const contactId = await invite(t, owner);
    await resend(t, owner, contactId);
    await resend(t, owner, contactId);

    await expect(invite(t, other)).resolves.toBeDefined();
  });
});

describe("migrateContactTypes", () => {
  it("turns legacy recipient-only contacts into trust contacts", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const trustId = await seedTrustContact(t, owner, { n: 1 });
    const recipientId = await seedTrustContact(t, owner, { n: 2 });
    const groupId = await t.run(async (ctx) => {
      await ctx.db.patch(trustId, { contactType: "trust" });
      await ctx.db.patch(recipientId, { contactType: "recipient_only" });
      return await ctx.db.insert("recipient_groups", {
        userId: owner,
        name: "Trusted Contacts",
        memberContactIds: [trustId],
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateContactTypes,
      {},
    );
    expect(result).toEqual({ scanned: 2, migrated: 2 });

    const [trust, recipient, group] = await t.run((ctx) =>
      Promise.all([
        ctx.db.get(trustId),
        ctx.db.get(recipientId),
        ctx.db.get(groupId),
      ]),
    );
    expect(trust).not.toHaveProperty("contactType");
    expect(recipient).not.toHaveProperty("contactType");
    expect(group?.memberContactIds).toEqual([trustId, recipientId]);

    // Idempotent: a second run is a no-op.
    expect(
      await t.mutation(internal.migrations.migrateContactTypes, {}),
    ).toEqual({ scanned: 2, migrated: 0 });
  });
});

describe("updateContact", () => {
  async function invite(
    t: ReturnType<typeof makeT>,
    owner: Id<"users">,
    n: number,
  ) {
    const { contactId } = await asUser(t, owner).mutation(
      api.trusted_contacts.inviteContact,
      {
        name: `Contact ${n}`,
        email: `c${n}@example.com`,
        role: "friend",
        _audit: await signedAudit(),
      },
    );
    return contactId;
  }

  it("edits an accepted contact's details without touching the invitation", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    const before = await t.run((ctx) => ctx.db.get(contactId));

    await asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
      contactId,
      name: "  Ada Lovelace ",
      email: "ADA@example.com",
      phoneNumber: "+33612345678",
      role: "lawyer",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row).toMatchObject({
      name: "Ada Lovelace",
      role: "lawyer",
      email: "ada@example.com",
      phoneNumber: "+33612345678",
      invitationStatus: "accepted",
      invitationToken: before?.invitationToken,
    });
  });

  it("re-issues a pending invitation when its email or phone changes", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await invite(t, owner, 1);
    const before = await t.run((ctx) => ctx.db.get(contactId));

    await asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
      contactId,
      name: "Contact 1",
      email: "fixed@example.com",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.email).toBe("fixed@example.com");
    expect(row?.invitationToken).not.toBe(before?.invitationToken);
  });

  it("keeps a pending invitation when only the name changes", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await invite(t, owner, 1);
    const before = await t.run((ctx) => ctx.db.get(contactId));

    await asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
      contactId,
      name: "Renamed",
      email: "c1@example.com",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.name).toBe("Renamed");
    expect(row?.invitationToken).toBe(before?.invitationToken);
  });

  it("refuses an email already used by another contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContact(t, owner, { n: 1 });
    const contactId = await seedTrustContact(t, owner, { n: 2 });

    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
        contactId,
        name: "Contact 2",
        email: "c1@example.com",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("refuses a contact with neither email nor phone", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });

    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.updateContact, {
        contactId,
        name: "Contact 1",
        email: " ",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/email or a phone number/);
  });

  it("refuses to edit another owner's contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const stranger = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });

    await expect(
      asUser(t, stranger).mutation(api.trusted_contacts.updateContact, {
        contactId,
        name: "Hijacked",
        email: "c1@example.com",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("getVaultsWhereIAmContact", () => {
  async function seedLink(
    t: ReturnType<typeof makeT>,
    owner: Partial<{ name: string; phoneNumber: string }>,
  ) {
    const ownerId = await t.run((ctx) => ctx.db.insert("users", owner));
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, ownerId, { n: 1 });
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );
    return { ownerId, contactUser };
  }

  it("identifies a phone-only owner by their phone, not 'Keeplas user'", async () => {
    const t = makeT();
    const { contactUser } = await seedLink(t, { phoneNumber: "+33612345678" });

    const [vault] = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );
    expect(vault?.ownerName).toBe("+33612345678");
    expect(vault?.ownerPhone).toBe("+33612345678");
  });

  it("returns the owner's name, phone and confirmation threshold", async () => {
    const t = makeT();
    const { ownerId, contactUser } = await seedLink(t, {
      name: "Ada",
      phoneNumber: "+33612345678",
    });
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("life_check_configs", {
        userId: ownerId,
        frequency: "monthly",
        activeChannels: [],
        travelModeEnabled: false,
        isActive: true,
        nextCheckAt: now,
        confirmationThreshold: 3,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const [vault] = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );
    expect(vault).toMatchObject({
      ownerName: "Ada",
      ownerPhone: "+33612345678",
      confirmationThreshold: 3,
    });
  });

  it("keeps the owner's private row fields from the contact", async () => {
    const t = makeT();
    const { contactUser } = await seedLink(t, { name: "Ada" });

    const [vault] = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );
    for (const field of [
      "name",
      "role",
      "invitationToken",
      "pinnedIdentityFingerprint",
      "reconfirmReminders",
      "ownerNotifiedUnavailableAt",
    ]) {
      expect(vault).not.toHaveProperty(field);
    }
  });

  it("caps the owner's name its contacts see", async () => {
    const t = makeT();
    const { ownerId, contactUser } = await seedLink(t, {});
    await asUser(t, ownerId).mutation(api.users.updateProfile, {
      name: "x".repeat(10_000),
      _audit: await signedAudit(),
    });

    const [vault] = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );
    expect(vault?.ownerName).toHaveLength(100);
  });

  it("defaults the confirmation threshold to 2", async () => {
    const t = makeT();
    const { contactUser } = await seedLink(t, { name: "Ada" });

    const [vault] = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );
    expect(vault?.confirmationThreshold).toBe(2);
    expect(vault?.ownerPhone).toBeNull();
  });
});

describe("getVaultsWhereIAmContact unreachability vote", () => {
  it("reports whether I already confirmed the owner can't be reached", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(contactId, { contactUserId: contactUser });
      const configId = await ctx.db.insert("life_check_configs", {
        userId: owner,
        frequency: "monthly",
        activeChannels: [],
        travelModeEnabled: false,
        isActive: true,
        nextCheckAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("life_check_cycles", {
        userId: owner,
        configId,
        status: "awaiting_confirmation",
        channelsAttempted: [],
        scheduledAt: now,
        startedAt: now,
      });
    });
    const vaults = () =>
      asUser(t, contactUser).query(
        api.trusted_contacts.getVaultsWhereIAmContact,
        {},
      );

    expect((await vaults())[0]?.unreachableConfirmed).toBe(false);

    await asUser(t, contactUser).mutation(
      api.access_requests.markUserUnreachable,
      { contactId, _audit: await signedAudit() },
    );

    expect((await vaults())[0]?.unreachableConfirmed).toBe(true);
  });
});

describe("getReleaseQuorum", () => {
  it("counts distinct accepted people against the owner's threshold", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const person = await seedUser(t);
    // The same person invited twice (email + phone) is one confirmation.
    for (const n of [1, 2]) {
      const id = await seedTrustContact(t, owner, { n });
      await t.run((ctx) => ctx.db.patch(id, { contactUserId: person }));
    }
    // Still pending: cannot confirm anything yet.
    const pending = await seedTrustContact(t, owner, { n: 3 });
    await t.run((ctx) =>
      ctx.db.patch(pending, { invitationStatus: "pending" }),
    );

    const quorum = await asUser(t, owner).query(
      api.trusted_contacts.getReleaseQuorum,
      {},
    );
    expect(quorum).toEqual({ required: 2, available: 1 });
  });
});
