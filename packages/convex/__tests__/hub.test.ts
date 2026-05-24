import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, seedTrustContact } from "./test.helpers";

function distributeDone(
  hub: Awaited<ReturnType<ReturnType<typeof makeT>["query"]>>,
): boolean {
  const actions = (
    hub as { priorityActions: Array<{ key: string; done: boolean }> }
  ).priorityActions;
  return actions.find((a) => a.key === "distribute_shards")!.done;
}

describe("hub shardsDistributed floor", () => {
  it("is not done with a single confirmed trust contact", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContact(t, owner, { shardIndex: 2, confirmed: true });

    const hub = await asUser(t, owner).query(api.hub.getHubData, {});
    expect(distributeDone(hub)).toBe(false);
  });

  it("is done with two confirmed trust contacts", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedTrustContact(t, owner, { shardIndex: 2, confirmed: true });
    await seedTrustContact(t, owner, { shardIndex: 3, confirmed: true });

    const hub = await asUser(t, owner).query(api.hub.getHubData, {});
    expect(distributeDone(hub)).toBe(true);
  });
});
