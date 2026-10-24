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

describe("vault category rename and delete", () => {
  async function setup() {
    const t = makeT();
    const owner = asUser(t, await seedUser(t));
    const stranger = asUser(t, await seedUser(t));
    const categoryId = await owner.mutation(api.vault_categories.create, {
      encryptedName: SEALED,
      _audit: await signedAudit(),
    });
    return { owner, stranger, categoryId };
  }

  it("renames the owner's category", async () => {
    const { owner, categoryId } = await setup();
    const renamed = JSON.stringify({ ciphertext: "cmVuYW1lZA==", iv: "aXY=" });
    await owner.mutation(api.vault_categories.rename, {
      categoryId,
      encryptedName: renamed,
      _audit: await signedAudit(),
    });
    expect(await owner.query(api.vault_categories.list, {})).toMatchObject([
      { _id: categoryId, encryptedName: renamed },
    ]);
  });

  it("deletes the owner's category", async () => {
    const { owner, categoryId } = await setup();
    await owner.mutation(api.vault_categories.remove, {
      categoryId,
      _audit: await signedAudit(),
    });
    expect(await owner.query(api.vault_categories.list, {})).toEqual([]);
  });

  it("refuses another user's category", async () => {
    const { owner, stranger, categoryId } = await setup();
    await expect(
      stranger.mutation(api.vault_categories.rename, {
        categoryId,
        encryptedName: SEALED,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Category not found");
    await expect(
      stranger.mutation(api.vault_categories.remove, {
        categoryId,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Category not found");
    expect(await owner.query(api.vault_categories.list, {})).toHaveLength(1);
  });
});
