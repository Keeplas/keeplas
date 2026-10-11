import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  seedTrustContact,
} from "./test.helpers";

describe("confirmAvailability", () => {
  it("stamps lastVerifiedAt for an accepted trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    // Link the row to the accepting contact's account so they can authenticate.
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );

    const result = await asUser(t, contactUser).mutation(
      api.trusted_contacts.confirmAvailability,
      { contactId, _audit: await signedAudit() },
    );
    expect(result).toEqual({ success: true });

    const row = await t.run((ctx) => ctx.db.get(contactId));
    expect(row?.lastVerifiedAt).toBeTypeOf("number");
  });

  it("refuses a recipient-only contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    await t.run((ctx) =>
      ctx.db.patch(contactId, {
        contactUserId: contactUser,
        contactType: "recipient_only",
      }),
    );

    await expect(
      asUser(t, contactUser).mutation(
        api.trusted_contacts.confirmAvailability,
        { contactId, _audit: await signedAudit() },
      ),
    ).rejects.toThrow("Only trust contacts confirm availability");
  });
});
