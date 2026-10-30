import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

/**
 * Finding #2 — malicious-server ML-KEM key substitution.
 * These tests cover the BACKEND half: that the queries the client uses to wrap
 * surface the contact's identity material, the owner's pin MAC and whether the
 * contact was already sealed to (so the client can verify before wrapping), and
 * that the TOFU pin mutations behave (first pin / MAC upgrade / explicit
 * re-pin). The verify-before-wrap crypto is unit-tested in packages/crypto
 * (contact-trust.test.ts).
 */

async function seedTrustContactWithIdentity(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: {
    n: number;
    contactUserId?: Id<"users">;
    identityPublicKey?: string;
    publicKeySignature?: string;
    pinnedIdentityFingerprint?: string;
    pinnedIdentityMac?: string;
  },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      contactUserId: opts.contactUserId,
      name: `Contact ${opts.n}`,
      email: `c${opts.n}@example.com`,
      role: "family",
      invitationStatus: "accepted",
      invitationToken: `tok-${opts.n}-${now}`,
      invitedAt: now,
      contactPublicKey: "mlkem-pub",
      contactIdentityPublicKey: opts.identityPublicKey,
      contactPublicKeySignature: opts.publicKeySignature,
      pinnedIdentityFingerprint: opts.pinnedIdentityFingerprint,
      pinnedIdentityMac: opts.pinnedIdentityMac,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("getItemRecipients surfaces identity material", () => {
  it("returns identity material for each recipient", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
      contactUserId: contactUser,
      identityPublicKey: "id-pub",
      publicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
      pinnedIdentityMac: "mac",
    });
    const vaultId = await t.run((ctx) =>
      ctx.db.insert("vaults", {
        userId: owner,
        encryptedItemsCount: 0,
        lastVerifiedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const itemId = await t.run((ctx) =>
      ctx.db.insert("vault_items", {
        vaultId,
        userId: owner,
        category: "personal_document",
        title: "t",
        encryptedContent: "c",
        encryptionType: "zero_knowledge",
        sharedWithContacts: [],
        accessLevel: "trusted_only",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("vault_item_recipient_keys", {
        itemId,
        contactId,
        wrappedDek: "w",
        createdAt: Date.now(),
      }),
    );

    const recipients = await asUser(t, owner).query(
      api.rotation.getItemRecipients,
      { itemId },
    );

    expect(recipients).toHaveLength(1);
    expect(recipients[0].contactIdentityPublicKey).toBe("id-pub");
    expect(recipients[0].contactPublicKeySignature).toBe("sig");
    expect(recipients[0].pinnedIdentityFingerprint).toBe("fp");
    expect(recipients[0].pinnedIdentityMac).toBe("mac");
    expect(recipients[0].contactUserId).toBe(contactUser);
    expect(recipients[0].hasWraps).toBe(true);
  });
});

describe("getContacts reports whether a contact was already sealed to", () => {
  it("is true once the contact holds an item wrap or a recovery share", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const fresh = await seedTrustContactWithIdentity(t, owner, { n: 1 });
    const withWrap = await seedTrustContactWithIdentity(t, owner, { n: 2 });
    const withShare = await seedTrustContactWithIdentity(t, owner, { n: 3 });
    await t.run(async (ctx) => {
      const vaultId = await ctx.db.insert("vaults", {
        userId: owner,
        encryptedItemsCount: 0,
        lastVerifiedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const itemId = await ctx.db.insert("vault_items", {
        vaultId,
        userId: owner,
        category: "personal_document",
        title: "t",
        encryptedContent: "c",
        encryptionType: "zero_knowledge",
        sharedWithContacts: [],
        accessLevel: "trusted_only",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("vault_item_recipient_keys", {
        itemId,
        contactId: withWrap,
        wrappedDek: "w",
        createdAt: Date.now(),
      });
      await ctx.db.insert("recovery_secret_shares", {
        userId: owner,
        contactId: withShare,
        generation: 1,
        wrappedShare: "s",
      });
    });

    const contacts = await asUser(t, owner).query(
      api.trusted_contacts.getContacts,
      {},
    );
    expect(
      Object.fromEntries(contacts.map((c) => [c._id, c.hasWraps])),
    ).toEqual({ [fresh]: false, [withWrap]: true, [withShare]: true });
  });
});

describe("pinContactIdentity (TOFU first pin)", () => {
  it("pins with the owner's MAC, refuses to overwrite a different pin", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
      identityPublicKey: "id-pub",
      publicKeySignature: "sig",
    });

    await asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
      contactId,
      fingerprint: "fp-1",
      mac: "mac-1",
      _audit: await signedAudit(),
    });
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityFingerprint).toBe("fp-1");
    expect(after?.pinnedIdentityMac).toBe("mac-1");

    // Another identity must go through the explicit re-pin.
    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
        contactId,
        fingerprint: "fp-2",
        mac: "mac-2",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already pinned/i);
  });

  it("adds the MAC to a legacy pin of the same identity", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
      pinnedIdentityFingerprint: "fp-1",
    });

    await asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
      contactId,
      fingerprint: "fp-1",
      mac: "mac-1",
      _audit: await signedAudit(),
    });
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityFingerprint).toBe("fp-1");
    expect(after?.pinnedIdentityMac).toBe("mac-1");
  });

  it("refuses an unMACed pin over an existing one (older clients)", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
      pinnedIdentityFingerprint: "fp-1",
      pinnedIdentityMac: "mac-1",
    });
    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
        contactId,
        fingerprint: "fp-1",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already pinned/i);
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityMac).toBe("mac-1");
  });

  it("rejects pinning a contact the caller does not own", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const stranger = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
    });
    await expect(
      asUser(t, stranger).mutation(api.trusted_contacts.pinContactIdentity, {
        contactId,
        fingerprint: "fp",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow();
  });
});

describe("repinContactIdentity (explicit deliberate-change)", () => {
  it("overwrites an existing pin with the owner-reviewed fingerprint", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      n: 2,
      pinnedIdentityFingerprint: "fp-old",
      pinnedIdentityMac: "mac-old",
    });

    await asUser(t, owner).mutation(api.trusted_contacts.repinContactIdentity, {
      contactId,
      fingerprint: "fp-new",
      mac: "mac-new",
      _audit: await signedAudit(),
    });
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityFingerprint).toBe("fp-new");
    expect(after?.pinnedIdentityMac).toBe("mac-new");
  });
});
