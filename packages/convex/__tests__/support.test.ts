import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

// support.submitTicket works signed out, and each ticket sends an email
// through the transactional Resend account: it is throttled and its fields
// are capped so it cannot be used to flood the inbox or the email quota.

const ticket = {
  name: "Ada",
  contact: "ada@example.com",
  topic: "general" as const,
  subject: "Question",
  message: "How do I add a contact?",
};

describe("support.submitTicket", () => {
  it("accepts a ticket from a signed-out visitor", async () => {
    const t = makeT();
    const { ticketId } = await t.mutation(api.support.submitTicket, {
      ...ticket,
      _audit: await signedAudit(),
    });
    expect(await t.run((ctx) => ctx.db.get(ticketId))).not.toBeNull();
  });

  it.each([
    ["name", "x".repeat(101)],
    ["subject", "x".repeat(201)],
    ["message", "x".repeat(5001)],
  ])("refuses an oversized %s", async (field, value) => {
    const t = makeT();
    await expect(
      t.mutation(api.support.submitTicket, {
        ...ticket,
        [field]: value,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/at most/);
  });

  it("throttles signed-out tickets per IP", async () => {
    const t = makeT();
    const _audit = await signedAudit();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.support.submitTicket, { ...ticket, _audit });
    }
    await expect(
      t.mutation(api.support.submitTicket, { ...ticket, _audit }),
    ).rejects.toThrow("Too many requests");

    // A signed-in account has its own budget.
    const userId = await seedUser(t);
    await expect(
      asUser(t, userId).mutation(api.support.submitTicket, {
        ...ticket,
        _audit,
      }),
    ).resolves.toHaveProperty("ticketId");
  });
});
