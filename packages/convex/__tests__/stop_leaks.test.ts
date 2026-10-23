import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import * as accessRequests from "../access_requests";
import * as trustedContacts from "../trusted_contacts";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

/**
 * v2 phase 2 — "stop the leaks". No trusted contact may ever obtain the
 * owner's MasterKey (F1), and no MasterKey shard survives anywhere (F2).
 */

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
    for (const field of ["shardIndex", "encryptedShard", "shardConfirmed"]) {
      expect(row).not.toHaveProperty(field);
    }
  });

  it("the schema refuses to store a shard on a contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const now = Date.now();

    await expect(
      t.run((ctx) =>
        ctx.db.insert("trusted_contacts", {
          userId: owner,
          name: "Legacy",
          role: "family",
          invitationStatus: "accepted",
          invitationToken: "tok-legacy",
          invitedAt: now,
          encryptedShard: "wrapped-master-key-shard",
          createdAt: now,
          updatedAt: now,
        } as never),
      ),
    ).rejects.toThrow();
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
