import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

const SEALED = JSON.stringify({ ciphertext: "c2VhbGVk", iv: "aXY=" });

describe("vault categories", () => {
  it("lists only the owner's categories", async () => {
    const t = makeT();
    const owner = asUser(t, await seedUser(t));
    const other = asUser(t, await seedUser(t));
    const categoryId = await owner.mutation(api.vault_categories.create, {
      encryptedName: SEALED,
      _audit: await signedAudit(),
    });

    expect(await owner.query(api.vault_categories.list, {})).toMatchObject([
      { _id: categoryId, encryptedName: SEALED },
    ]);
    expect(await other.query(api.vault_categories.list, {})).toEqual([]);
  });

  it("audits the creation", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const categoryId = await asUser(t, userId).mutation(
      api.vault_categories.create,
      { encryptedName: SEALED, _audit: await signedAudit() },
    );
    const logs = await t.run((ctx) =>
      ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "vault_category.created",
        resourceId: categoryId,
      }),
    );
  });
});
