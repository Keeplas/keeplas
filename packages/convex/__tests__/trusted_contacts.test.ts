import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
} from "./test.helpers";

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
