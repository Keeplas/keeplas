import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, signedAudit } from "./test.helpers";

describe("setPublicKey — identity key fields (finding #2, step 1)", () => {
  it("persists the ML-KEM keypair plus the 3 identity fields", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await asUser(t, owner).mutation(api.users.setPublicKey, {
      publicKey: "ml-kem-public-key",
      encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
      identityPublicKey: "ml-dsa-public-key",
      encryptedIdentitySecretKey: "wrapped-ml-dsa-secret",
      publicKeySignature: "ml-dsa-signature-over-ml-kem-pubkey",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("ml-kem-public-key");
    expect(user?.encryptedAsymmetricSecretKey).toBe("wrapped-ml-kem-secret");
    expect(user?.identityPublicKey).toBe("ml-dsa-public-key");
    expect(user?.encryptedIdentitySecretKey).toBe("wrapped-ml-dsa-secret");
    expect(user?.publicKeySignature).toBe(
      "ml-dsa-signature-over-ml-kem-pubkey",
    );
  });

  it("still works without identity fields (backward compatible)", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await asUser(t, owner).mutation(api.users.setPublicKey, {
      publicKey: "ml-kem-public-key",
      encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("ml-kem-public-key");
    expect(user?.identityPublicKey).toBeUndefined();
    expect(user?.encryptedIdentitySecretKey).toBeUndefined();
    expect(user?.publicKeySignature).toBeUndefined();
  });

  it("rejects a different ML-KEM public key once one is set", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { publicKey: "existing-public-key" }),
    );

    await expect(
      asUser(t, owner).mutation(api.users.setPublicKey, {
        publicKey: "a-different-public-key",
        encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
        identityPublicKey: "ml-dsa-public-key",
        encryptedIdentitySecretKey: "wrapped-ml-dsa-secret",
        publicKeySignature: "sig",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow();
  });
});

describe("setPublicKey — backfills owner rows when crypto comes online", () => {
  // Seed an accepted trusted_contacts row where `contact` is the contact, but
  // `contactPublicKey` is missing — the accept-before-crypto state.
  async function seedAcceptedRowAwaitingKey(
    t: ReturnType<typeof makeT>,
    ownerId: Awaited<ReturnType<typeof seedUser>>,
    contactId: Awaited<ReturnType<typeof seedUser>>,
  ) {
    const now = Date.now();
    return await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: ownerId,
        contactUserId: contactId,
        name: "Awaiting Key",
        email: "awaiting@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "accepted",
        invitationToken: `tok-${now}`,
        invitedAt: now,
        shardIndex: 2,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  it("publishes the key to a row accepted before crypto was ready", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contact = await seedUser(t);
    const rowId = await seedAcceptedRowAwaitingKey(t, owner, contact);

    // Precondition: the owner's row has no key yet.
    const before = await t.run((ctx) => ctx.db.get(rowId));
    expect(before?.contactPublicKey).toBeUndefined();

    // The contact finalizes their crypto.
    await asUser(t, contact).mutation(api.users.setPublicKey, {
      publicKey: "contact-ml-kem",
      encryptedAsymmetricSecretKey: "wrapped-secret",
      identityPublicKey: "contact-ml-dsa",
      encryptedIdentitySecretKey: "wrapped-identity",
      publicKeySignature: "contact-sig",
      _audit: await signedAudit(),
    });

    // The owner's row is now ready to wrap to — no /shared-with-me visit needed.
    const after = await t.run((ctx) => ctx.db.get(rowId));
    expect(after?.contactPublicKey).toBe("contact-ml-kem");
    expect(after?.contactIdentityPublicKey).toBe("contact-ml-dsa");
    expect(after?.contactPublicKeySignature).toBe("contact-sig");
  });

  it("does not touch a pending (unaccepted) row", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contact = await seedUser(t);
    const now = Date.now();
    const pendingRowId = await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        contactUserId: contact,
        name: "Still Pending",
        email: "pending@example.com",
        role: "family",
        contactType: "trust",
        invitationStatus: "pending",
        invitationToken: `tok-pending-${now}`,
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await asUser(t, contact).mutation(api.users.setPublicKey, {
      publicKey: "contact-ml-kem",
      encryptedAsymmetricSecretKey: "wrapped-secret",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(pendingRowId));
    expect(row?.contactPublicKey).toBeUndefined();
  });
});
