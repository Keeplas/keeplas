import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, seedTrustContact } from "./test.helpers";

function contactsReadyDone(
  hub: Awaited<ReturnType<ReturnType<typeof makeT>["query"]>>,
): boolean {
  const actions = (
    hub as { priorityActions: Array<{ key: string; done: boolean }> }
  ).priorityActions;
  return actions.find((a) => a.key === "contacts_ready")!.done;
}

describe("hub contacts-ready floor", () => {
  it("is not done with a single ready trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContact(t, owner, { n: 2 });

    const hub = await asUser(t, owner).query(api.hub.getHubData, {});
    expect(contactsReadyDone(hub)).toBe(false);
  });

  it("is done with two ready trust contacts", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContact(t, owner, { n: 2 });
    await seedTrustContact(t, owner, { n: 3 });

    const hub = await asUser(t, owner).query(api.hub.getHubData, {});
    expect(contactsReadyDone(hub)).toBe(true);
  });
});
