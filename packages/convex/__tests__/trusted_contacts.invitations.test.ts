import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  asUser,
  makeT,
  seedUser,
  seedVerifiedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

/** Insert a pending invitation addressed to `email` and/or `phoneNumber`. */
async function seedInvite(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: { token: string; email?: string; phoneNumber?: string },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      name: "Invited Person",
      email: opts.email,
      phoneNumber: opts.phoneNumber,
      role: "family",
      invitationStatus: "pending",
      invitationToken: opts.token,
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("acceptInvitation never writes invite identifiers onto the account", () => {
  it("leaves a phone-only accepter's email unset (finding 1)", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    // The owner typed the invitee's real phone plus an email they control.
    await seedInvite(t, owner, {
      token: "tok-phone-only",
      phoneNumber: "+14155550111",
      email: "attacker@example.com",
    });
    const invitee = await seedVerifiedUser(t, { phoneNumber: "+14155550111" });

    await asUser(t, invitee).mutation(api.trusted_contacts.acceptInvitation, {
      token: "tok-phone-only",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(invitee));
    expect(user?.email).toBeUndefined();
  });

  it("leaves an email-only accepter's phone unset", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedInvite(t, owner, {
      token: "tok-email-only",
      email: "invitee@example.com",
      phoneNumber: "+14155550112",
    });
    const invitee = await seedVerifiedUser(t, { email: "invitee@example.com" });

    await asUser(t, invitee).mutation(api.trusted_contacts.acceptInvitation, {
      token: "tok-email-only",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(invitee));
    expect(user?.phoneNumber).toBeUndefined();
  });
});
