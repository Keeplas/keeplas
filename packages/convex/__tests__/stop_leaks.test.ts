import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import * as accessRequests from "../access_requests";
import * as trustedContacts from "../trusted_contacts";
import {
  asUser,
  makeT,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

/**
 * v2 phase 2 — "stop the leaks". No trusted contact may ever obtain the
 * owner's MasterKey (F1), and no MasterKey shard survives anywhere (F2).
 */

/** A pre-v2 trust contact row still carrying a wrapped MasterKey shard. */
async function seedLegacyShardContact(
  t: TestConvex,
  ownerId: Id<"users">,
  n: number,
  contactUserId?: Id<"users">,
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      contactUserId,
      name: `Legacy ${n}`,
      email: `legacy${n}@example.com`,
      role: "family",
      contactType: "trust",
      invitationStatus: "accepted",
      invitationToken: `legacy-${n}-${now}`,
      invitedAt: now,
      shardIndex: n + 1,
      encryptedShard: `wrapped-master-key-shard-${n}`,
      shardPublicKeyUsed: "pk",
      shardConfirmed: true,
      contactPublicKey: "pk",
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("F1 — contacts cannot rebuild the owner's MasterKey", () => {
  it("exposes no endpoint that submits, serves or distributes shards", () => {
    for (const name of [
      "submitRecoveryShards",
      "getRecoveryShardsForMe",
      "getRecoveryPeers",
      "getRecoverySubmissionCount",
      "getActiveAccessRequestForContact",
    ]) {
      expect(accessRequests).not.toHaveProperty(name);
    }
    for (const name of [
      "storeEncryptedShard",
      "getDistributionTargets",
      "confirmShardVerified",
    ]) {
      expect(trustedContacts).not.toHaveProperty(name);
    }
  });

  it("never returns a legacy shard to the contact, even after a release", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedLegacyShardContact(t, owner, 1, contactUser);
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.insert("access_requests", {
        vaultUserId: owner,
        requestedBy: contactId,
        sectionsRequested: ["item:abc"],
        status: "approved",
        autoResponseAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const vaults = await asUser(t, contactUser).query(
      api.trusted_contacts.getVaultsWhereIAmContact,
      {},
    );

    expect(vaults).toHaveLength(1);
    expect(vaults[0].released).toBe(true);
    expect(JSON.stringify(vaults)).not.toContain("wrapped-master-key-shard");
    expect(vaults[0]).not.toHaveProperty("encryptedShard");
  });
});

describe("F2 — the MasterKey is never split", () => {
  it("invites a trust contact without any shard slot", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    const { contactId } = await asUser(t, owner).mutation(
      api.trusted_contacts.inviteContact,
      {
        name: "Ada",
        email: "ada@example.com",
        role: "family",
        _audit: await signedAudit(),
      },
    );

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.contactType ?? "trust").toBe("trust");
    expect(row?.shardIndex).toBeUndefined();
    expect(row?.encryptedShard).toBeUndefined();
    expect(row?.shardConfirmed).toBeUndefined();
  });

  it("purgeMasterKeyShards clears every shard and flags exposed owners", async () => {
    const t = makeT();
    const exposedOwner = await seedUser(t);
    const cleanOwner = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(exposedOwner, { vaultThreshold: 2 }));
    await t.run((ctx) => ctx.db.patch(cleanOwner, { vaultThreshold: 2 }));
    const c1 = await seedLegacyShardContact(t, exposedOwner, 1);
    const c2 = await seedLegacyShardContact(t, exposedOwner, 2);
    // An invited-but-never-distributed slot: no shard ever left the owner.
    const pending = await seedLegacyShardContact(t, cleanOwner, 3);
    await t.run((ctx) => ctx.db.patch(pending, { encryptedShard: "" }));
    const now = Date.now();
    await t.run(async (ctx) => {
      const requestId = await ctx.db.insert("access_requests", {
        vaultUserId: exposedOwner,
        requestedBy: c1,
        sectionsRequested: ["all"],
        status: "approved",
        autoResponseAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("recovery_shard_submissions", {
        accessRequestId: requestId,
        vaultUserId: exposedOwner,
        submitterContactId: c1,
        recipientContactId: c2,
        wrappedShard: "wrapped-peer-shard",
        createdAt: now,
      });
    });

    const result = await t.mutation(
      internal.migrations.purgeMasterKeyShards,
      {},
    );
    expect(result).toEqual({
      contactsCleared: 3,
      submissionsDeleted: 1,
      usersPatched: 2,
      ownersFlaggedForRotation: 1,
    });

    for (const id of [c1, c2, pending]) {
      const row = await t.run((ctx) => ctx.db.get(id));
      expect(row?.shardIndex).toBeUndefined();
      expect(row?.encryptedShard).toBeUndefined();
      expect(row?.shardPublicKeyUsed).toBeUndefined();
      expect(row?.shardConfirmed).toBeUndefined();
    }
    const submissions = await t.run((ctx) =>
      ctx.db.query("recovery_shard_submissions").collect(),
    );
    expect(submissions).toHaveLength(0);

    const exposed = await t.run((ctx) => ctx.db.get(exposedOwner));
    expect(exposed?.vaultThreshold).toBeUndefined();
    expect(exposed?.masterKeyRotationRequired).toBe(true);
    const clean = await t.run((ctx) => ctx.db.get(cleanOwner));
    expect(clean?.vaultThreshold).toBeUndefined();
    expect(clean?.masterKeyRotationRequired).toBeUndefined();

    // Idempotent: nothing left to clear, nobody newly flagged.
    const again = await t.mutation(
      internal.migrations.purgeMasterKeyShards,
      {},
    );
    expect(again).toEqual({
      contactsCleared: 0,
      submissionsDeleted: 0,
      usersPatched: 0,
      ownersFlaggedForRotation: 0,
    });
  });

  it("a finished rotation clears the forced-rotation flag", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { masterKeyRotationRequired: true }),
    );

    await asUser(t, owner).mutation(api.rotation.finalizeRotation, {
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.masterKeyRotationRequired).toBeUndefined();
  });
});
