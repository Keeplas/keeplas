import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// What lands on an owner's trusted_contacts row is the contact's REGISTERED
// key material (users row), never a key the contact's client picks: owners
// verify-before-wrap against that row.

const REGISTERED = {
  publicKey: "registered-ml-kem",
  identityPublicKey: "registered-ml-dsa",
  publicKeySignature: "registered-signature",
};

async function seedContactUser(t: TestConvex): Promise<Id<"users">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      ...REGISTERED,
      email: "contact@example.com",
      emailVerificationTime: now,
    }),
  );
}

async function seedRow(
  t: TestConvex,
  ownerId: Id<"users">,
  fields: {
    invitationStatus: "pending" | "accepted";
    contactUserId?: Id<"users">;
  },
) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      name: "Contact",
      email: "contact@example.com",
      role: "family",
      invitationToken: "tok-contact-key",
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
      ...fields,
    }),
  );
}

describe("republishContactPublicKey", () => {
  it("publishes the caller's registered key, not the one it sends", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contact = await seedContactUser(t);
    const rowId = await seedRow(t, owner, {
      invitationStatus: "accepted",
      contactUserId: contact,
    });

    await asUser(t, contact).mutation(
      api.trusted_contacts.republishContactPublicKey,
      { contactPublicKey: "attacker-ml-kem", _audit: await signedAudit() },
    );

    const row = await t.run((ctx) => ctx.db.get(rowId));
    expect(row?.contactPublicKey).toBe(REGISTERED.publicKey);
    expect(row?.contactIdentityPublicKey).toBe(REGISTERED.identityPublicKey);
    expect(row?.contactPublicKeySignature).toBe(REGISTERED.publicKeySignature);
  });

  it("refuses when the caller has no registered key yet", async () => {
    const t = makeT();
    const contact = await seedUser(t);
    await expect(
      asUser(t, contact).mutation(
        api.trusted_contacts.republishContactPublicKey,
        { contactPublicKey: "attacker-ml-kem", _audit: await signedAudit() },
      ),
    ).rejects.toThrow("No public key");
  });
});

describe("acceptInvitation", () => {
  it("stores the accepter's registered key, not the one it sends", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contact = await seedContactUser(t);
    const rowId = await seedRow(t, owner, { invitationStatus: "pending" });

    await asUser(t, contact).mutation(api.trusted_contacts.acceptInvitation, {
      token: "tok-contact-key",
      contactPublicKey: "attacker-ml-kem",
      _audit: await signedAudit(),
    });

    const accepted = await t.run((ctx) => ctx.db.get(rowId));
    expect(accepted?.contactPublicKey).toBe(REGISTERED.publicKey);
    expect(accepted?.contactIdentityPublicKey).toBe(
      REGISTERED.identityPublicKey,
    );
  });
});
