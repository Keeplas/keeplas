import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

describe("users.setHiddenCategoryGroups", () => {
  it("hides built-in categories the owner deleted, and restores them", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const me = asUser(t, userId);

    await me.mutation(api.users.setHiddenCategoryGroups, {
      groups: ["accounts", "instructions"],
      _audit: await signedAudit(),
    });
    expect(
      (await me.query(api.users.viewer, {}))?.hiddenCategoryGroups,
    ).toEqual(["accounts", "instructions"]);

    await me.mutation(api.users.setHiddenCategoryGroups, {
      groups: [],
      _audit: await signedAudit(),
    });
    expect(
      (await me.query(api.users.viewer, {}))?.hiddenCategoryGroups,
    ).toEqual([]);
  });
});
