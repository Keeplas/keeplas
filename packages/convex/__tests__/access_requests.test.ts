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
  it("revokes approved access, leaves pending untouched", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 2 });

    const approved = await seedAccessRequest(t, owner, contactId, "approved", [
      "item:abc",
    ]);
    const pending = await seedAccessRequest(t, owner, contactId, "pending", [
      "all",
    ]);

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
