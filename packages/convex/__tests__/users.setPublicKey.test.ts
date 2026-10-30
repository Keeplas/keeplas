import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  asUserSession,
  seedPasswordAccount,
  seedSession,
  signedAudit,
} from "./test.helpers";

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

// The identity key backs the "vault" session proof and every owner's TOFU pin:
// once published, the same ML-KEM key must not let a weaker session swap the
// identity key, signature or wrapped secrets behind it.
describe("setPublicKey — published key material is write-once", () => {
  const published = {
    publicKey: "ml-kem-public-key",
    encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
    identityPublicKey: "ml-dsa-public-key",
    encryptedIdentitySecretKey: "wrapped-ml-dsa-secret",
    publicKeySignature: "ml-dsa-signature",
  };

  async function seedPublished() {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(owner, published));
    return { t, owner };
  }

  it("refuses an attacker identity key behind the unchanged ML-KEM key", async () => {
    const { t, owner } = await seedPublished();
    await expect(
      asUser(t, owner).mutation(api.users.setPublicKey, {
        ...published,
        identityPublicKey: "attacker-ml-dsa",
        encryptedIdentitySecretKey: "attacker-wrapped",
        publicKeySignature: "attacker-signature",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("already set");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.identityPublicKey).toBe("ml-dsa-public-key");
    expect(user?.publicKeySignature).toBe("ml-dsa-signature");
  });

  it("refuses to overwrite the wrapped secret keys", async () => {
    const { t, owner } = await seedPublished();
    await expect(
      asUser(t, owner).mutation(api.users.setPublicKey, {
        ...published,
        encryptedAsymmetricSecretKey: "junk",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("already set");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.encryptedAsymmetricSecretKey).toBe("wrapped-ml-kem-secret");
  });

  it("refuses to add identity fields to a key published without them", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, {
        publicKey: published.publicKey,
        encryptedAsymmetricSecretKey: published.encryptedAsymmetricSecretKey,
      }),
    );
    await expect(
      asUser(t, owner).mutation(api.users.setPublicKey, {
        ...published,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("already set");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.identityPublicKey).toBeUndefined();
  });

  it("accepts the exact same material again (a retried setup)", async () => {
    const { t, owner } = await seedPublished();
    await asUser(t, owner).mutation(api.users.setPublicKey, {
      ...published,
      _audit: await signedAudit(),
    });
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.identityPublicKey).toBe("ml-dsa-public-key");
  });

  it("needs every step-up gate: a password alone cannot publish", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedPasswordAccount(t, owner);
    const sessionId = await seedSession(t, owner);
    await expect(
      asUserSession(t, owner, sessionId).mutation(api.users.setPublicKey, {
        ...published,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBeUndefined();
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
        invitationStatus: "accepted",
        invitationToken: `tok-${now}`,
        invitedAt: now,
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
