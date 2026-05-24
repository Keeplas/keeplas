import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

/** Insert an access_request row directly, bypassing the escalation flow. */
async function seedAccessRequest(
  t: TestConvex,
  ownerId: Id<"users">,
  contactId: Id<"trusted_contacts">,
  status: "pending" | "approved",
  sections: string[],
): Promise<Id<"access_requests">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("access_requests", {
      vaultUserId: ownerId,
      requestedBy: contactId,
      sectionsRequested: sections,
      status,
      autoResponseAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("revokeReleasedAccess", () => {
  it("revokes approved access, deletes recovery shards, leaves pending untouched", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { shardIndex: 2 });

    const approved = await seedAccessRequest(t, owner, contactId, "approved", [
      "item:abc",
    ]);
    const pending = await seedAccessRequest(t, owner, contactId, "pending", [
      "all",
    ]);

    // A wrapped recovery shard tied to the approved request.
    await t.run((ctx) =>
      ctx.db.insert("recovery_shard_submissions", {
        accessRequestId: approved,
        vaultUserId: owner,
        submitterContactId: contactId,
        recipientContactId: contactId,
        wrappedShard: "envelope",
        createdAt: Date.now(),
      }),
    );

    const result = await asUser(t, owner).mutation(
      api.access_requests.revokeReleasedAccess,
      { _audit: await signedAudit() },
    );

    expect(result.revokedCount).toBe(1);

    const approvedRow = await t.run((ctx) => ctx.db.get(approved));
    expect(approvedRow?.status).toBe("revoked");
    expect(approvedRow?.respondedAt).toBeTypeOf("number");

    const pendingRow = await t.run((ctx) => ctx.db.get(pending));
    expect(pendingRow?.status).toBe("pending");

    const shards = await t.run((ctx) =>
      ctx.db
        .query("recovery_shard_submissions")
        .withIndex("by_request", (q) => q.eq("accessRequestId", approved))
        .collect(),
    );
    expect(shards).toHaveLength(0);
  });

  it("is a no-op when no access has been granted", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    const result = await asUser(t, owner).mutation(
      api.access_requests.revokeReleasedAccess,
      { _audit: await signedAudit() },
    );

    expect(result).toEqual({ revokedCount: 0, contactsNotified: 0 });
  });
});
