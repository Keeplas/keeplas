import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

describe("vaults.getOrCreateVault", () => {
  it("records the vault's creation once in the owner's audit chain", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const owner = asUser(t, userId);

    const vaultId = await owner.mutation(api.vaults.getOrCreateVault, {});
    expect(await owner.mutation(api.vaults.getOrCreateVault, {})).toBe(vaultId);

    const logs = await t.run((ctx) =>
      ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(logs).toEqual([
      expect.objectContaining({
        action: "vault.created",
        resourceType: "vault",
        resourceId: vaultId,
        actorType: "user",
        actorId: userId,
      }),
    ]);
  });
});

describe("vault item access levels", () => {
  it.each(["public", "emergency_only"])(
    "refuses the legacy %s level on writes",
    async (accessLevel) => {
      const t = makeT();
      const userId = await seedUser(t);
      const owner = asUser(t, userId);
      const vaultId = await owner.mutation(api.vaults.getOrCreateVault, {});

      await expect(
        owner.mutation(api.vault_items.createItem, {
          vaultId,
          encryptedMeta: SEALED,
          encryptedTitle: SEALED,
          encryptedContent: SEALED,
          // @ts-expect-error legacy level, refused by the validator
          accessLevel,
          _audit: await signedAudit(),
        }),
      ).rejects.toThrow(/Validator/);
    },
  );
});
