import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
} from "./test.helpers";

describe("storeEncryptedShard recovery floor", () => {
  it("rejects distribution with a single accepted trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { shardIndex: 2 });

    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.storeEncryptedShard, {
        contactId,
        encryptedShard: "envelope",
        shardPublicKeyUsed: "pk",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/at least 2 trusted contacts/);
  });

  it("seals the shard once two trust contacts are accepted", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { shardIndex: 2 });
    await seedTrustContact(t, owner, { shardIndex: 3 });

    await asUser(t, owner).mutation(api.trusted_contacts.storeEncryptedShard, {
      contactId,
      encryptedShard: "envelope",
      shardPublicKeyUsed: "pk",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.shardConfirmed).toBe(true);
  });
});

describe("confirmShardVerified", () => {
  it("refuses to verify before a shard has been distributed", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, {
      shardIndex: 2,
      confirmed: false,
    });
    // Link the row to the accepting contact's account so they can authenticate.
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );

    await expect(
      asUser(t, contactUser).mutation(
        api.trusted_contacts.confirmShardVerified,
        { contactId, _audit: await signedAudit() },
      ),
    ).rejects.toThrow("No shard distributed to verify");

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.lastVerifiedAt).toBeUndefined();
  });

  it("stamps lastVerifiedAt once a shard is distributed", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, {
      shardIndex: 2,
      confirmed: true,
    });
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );

    const result = await asUser(t, contactUser).mutation(
      api.trusted_contacts.confirmShardVerified,
      { contactId, _audit: await signedAudit() },
    );
    expect(result).toEqual({ success: true });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.lastVerifiedAt).toBeTypeOf("number");
  });
});
