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
 * surface the contact's identity material (so the client can verify before
 * wrapping), and that the TOFU pin mutations behave (first-pin only / explicit
 * re-pin). The crypto verify-before-wrap logic is unit-tested in apps/web.
 */

async function seedTrustContactWithIdentity(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: {
    shardIndex: number;
    contactUserId?: Id<"users">;
    identityPublicKey?: string;
    publicKeySignature?: string;
    pinnedIdentityFingerprint?: string;
  },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      contactUserId: opts.contactUserId,
      name: `Contact ${opts.shardIndex}`,
      email: `c${opts.shardIndex}@example.com`,
      role: "family",
      contactType: "trust",
      invitationStatus: "accepted",
      invitationToken: `tok-${opts.shardIndex}-${now}`,
      invitedAt: now,
      shardIndex: opts.shardIndex,
      contactPublicKey: "mlkem-pub",
      contactIdentityPublicKey: opts.identityPublicKey,
      contactPublicKeySignature: opts.publicKeySignature,
      pinnedIdentityFingerprint: opts.pinnedIdentityFingerprint,
      shardConfirmed: true,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("getDistributionTargets surfaces identity material", () => {
  it("returns contactIdentityPublicKey + signature + pin for wrapping", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContactWithIdentity(t, owner, { shardIndex: 2 });
    await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 3,
      identityPublicKey: "id-pub",
      publicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
    });

    const targets = await asUser(t, owner).query(
      api.trusted_contacts.getDistributionTargets,
      {},
    );

    expect(targets).toHaveLength(2);
    const withId = targets.find((x) => x.contactIdentityPublicKey === "id-pub");
    expect(withId).toBeDefined();
    expect(withId?.contactPublicKeySignature).toBe("sig");
    expect(withId?.pinnedIdentityFingerprint).toBe("fp");
  });
});

describe("getItemRecipients surfaces identity material", () => {
  it("returns identity material for each recipient", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 2,
      identityPublicKey: "id-pub",
      publicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
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
  });
});

describe("getRecoveryPeers surfaces identity material (no pin)", () => {
  it("returns each peer's identity public key + signature", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const me = await seedUser(t);
    const peerUser = await seedUser(t);

    const myRow = await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 2,
      contactUserId: me,
    });
    await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 3,
      contactUserId: peerUser,
      identityPublicKey: "peer-id-pub",
      publicKeySignature: "peer-sig",
    });

    const peers = await asUser(t, me).query(
      api.access_requests.getRecoveryPeers,
      { contactId: myRow },
    );

    expect(peers).toHaveLength(1);
    expect(peers[0].contactIdentityPublicKey).toBe("peer-id-pub");
    expect(peers[0].contactPublicKeySignature).toBe("peer-sig");
  });
});

describe("pinContactIdentity (TOFU first-pin only)", () => {
  it("pins on first call, refuses to overwrite an existing pin", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 2,
      identityPublicKey: "id-pub",
      publicKeySignature: "sig",
    });

    await asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
      contactId,
      fingerprint: "fp-1",
      _audit: await signedAudit(),
    });
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityFingerprint).toBe("fp-1");

    // Second pin must be refused — a silent substitution can't overwrite.
    await expect(
      asUser(t, owner).mutation(api.trusted_contacts.pinContactIdentity, {
        contactId,
        fingerprint: "fp-2",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/already pinned/i);
  });

  it("rejects pinning a contact the caller does not own", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const stranger = await seedUser(t);
    const contactId = await seedTrustContactWithIdentity(t, owner, {
      shardIndex: 2,
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
      shardIndex: 2,
      pinnedIdentityFingerprint: "fp-old",
    });

    await asUser(t, owner).mutation(api.trusted_contacts.repinContactIdentity, {
      contactId,
      fingerprint: "fp-new",
      _audit: await signedAudit(),
    });
    const after = await t.run((ctx) => ctx.db.get(contactId));
    expect(after?.pinnedIdentityFingerprint).toBe("fp-new");
  });
});
