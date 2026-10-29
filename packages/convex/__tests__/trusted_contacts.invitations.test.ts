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

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

describe("declineInvitation is bound to the invitee (finding 5)", () => {
  it("refuses an account that is not the invited recipient", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedInvite(t, owner, {
      token: "tok-decline-stranger",
      email: "invitee@example.com",
    });
    // Someone the link was forwarded to, signed in to their own account.
    const stranger = await seedVerifiedUser(t, {
      email: "stranger@example.com",
    });

    await expect(
      asUser(t, stranger).mutation(api.trusted_contacts.declineInvitation, {
        token: "tok-decline-stranger",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/different email or phone number/);

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.invitationStatus).toBe("pending");
  });

  it("refuses an expired invitation", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedInvite(t, owner, {
      token: "tok-decline-expired",
      email: "invitee@example.com",
    });
    await t.run((ctx) =>
      ctx.db.patch(contactId, {
        invitedAt: Date.now() - INVITE_EXPIRY_MS - 1000,
      }),
    );
    const invitee = await seedVerifiedUser(t, { email: "invitee@example.com" });

    await expect(
      asUser(t, invitee).mutation(api.trusted_contacts.declineInvitation, {
        token: "tok-decline-expired",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/expired/);
  });

  it("lets the invited recipient decline", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactId = await seedInvite(t, owner, {
      token: "tok-decline-ok",
      phoneNumber: "+14155550113",
    });
    const invitee = await seedVerifiedUser(t, { phoneNumber: "+14155550113" });

    await asUser(t, invitee).mutation(api.trusted_contacts.declineInvitation, {
      token: "tok-decline-ok",
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.invitationStatus).toBe("declined");
  });
});

describe("getInvitationByToken exposes no personal data (finding 6)", () => {
  it("returns only the status, the inviter's display name and the expiry", async () => {
    const t = makeT();
    const owner = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ada",
        email: "ada@example.com",
        emailVerificationTime: Date.now(),
      }),
    );
    const contactId = await seedInvite(t, owner, {
      token: "tok-lookup",
      email: "invitee@example.com",
      phoneNumber: "+14155550114",
    });
    const row = await t.run((ctx) => ctx.db.get(contactId));

    const invitation = await t.query(api.trusted_contacts.getInvitationByToken, {
      token: "tok-lookup",
    });

    expect(invitation).toEqual({
      invitationStatus: "pending",
      inviterName: "Ada",
      expiresAt: row!.invitedAt + INVITE_EXPIRY_MS,
    });
  });
});

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
