import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { createAuditLog } from "../audit";
import {
  makeT,
  seedUser,
  asUser,
  asUserSession,
  seedPasswordAccount,
  seedSession,
} from "./test.helpers";

// Owner reads of the activity log and the hub sit behind the same step-up
// gates as the rest of the vault API (requireFullAuth).

async function passwordOnlySession() {
  const t = makeT();
  const userId = await seedUser(t);
  await seedPasswordAccount(t, userId);
  const as = asUserSession(t, userId, await seedSession(t, userId));
  return { t, userId, as };
}

describe("audit.listLogs", () => {
  it("needs every step-up gate", async () => {
    const { as } = await passwordOnlySession();
    await expect(as.query(api.audit.listLogs, {})).rejects.toThrow(
      "LOGIN_OTP_REQUIRED",
    );
  });

  it("returns only what the activity screens show (no IP, actor, metadata)", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contact = await seedUser(t);
    await t.run((ctx) =>
      createAuditLog(ctx, {
        userId: owner,
        actorType: "trusted_contact",
        actorId: contact,
        action: "trusted_contact.accepted",
        resourceType: "trusted_contact",
        resourceId: "row",
        metadata: JSON.stringify({ email: "contact@example.com" }),
        ipAddress: "203.0.113.7",
        country: "FR",
      }),
    );

    const logs = await asUser(t, owner).query(api.audit.listLogs, {});
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]).sort()).toEqual(
      ["_id", "action", "country", "createdAt"].sort(),
    );
    expect(logs[0]).toMatchObject({
      action: "trusted_contact.accepted",
      country: "FR",
    });
  });

  it("caps the page size", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i++) {
        await createAuditLog(ctx, {
          userId: owner,
          actorType: "user",
          actorId: owner,
          action: "user.profile.updated",
          resourceType: "user",
          resourceId: owner,
        });
      }
    });
    const logs = await asUser(t, owner).query(api.audit.listLogs, {
      limit: 10_000,
    });
    expect(logs).toHaveLength(200);
  });
});

describe("hub.getHubData", () => {
  it("needs every step-up gate", async () => {
    const { as } = await passwordOnlySession();
    await expect(as.query(api.hub.getHubData, {})).rejects.toThrow(
      "LOGIN_OTP_REQUIRED",
    );
  });
});
