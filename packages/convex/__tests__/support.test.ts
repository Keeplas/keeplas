import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { makeT } from "./test.helpers";

describe("support tickets", () => {
  it("takes an account deletion request from a signed-out visitor", async () => {
    const t = makeT();
    const { ticketId } = await t.mutation(api.support.submitTicket, {
      name: "Ada Lovelace",
      contact: "+33612345678",
      topic: "account_deletion",
      subject: "Delete my account",
      message: "I no longer have the app, please delete my account.",
    });
    const ticket = await t.run((ctx) => ctx.db.get(ticketId));
    expect(ticket).toMatchObject({
      topic: "account_deletion",
      whatsapp: "+33612345678",
      status: "open",
    });
    expect(ticket?.userId).toBeUndefined();
  });

  it("caps signed-out tickets per reply-to contact", async () => {
    const t = makeT();
    const submit = (contact: string) =>
      t.mutation(api.support.submitTicket, {
        name: "Visitor",
        contact,
        topic: "account_deletion",
        subject: "Delete my account",
        message: "Please delete the account on this number.",
      });
    for (let i = 0; i < 3; i++) await submit("+33612345678");
    await expect(submit("+33612345678")).rejects.toThrow("Too many requests");
    await expect(submit("+33699999999")).resolves.toHaveProperty("ticketId");
  });
});
