import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  seedStorageRef,
  asUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { StorageRef } from "../lib/storage";
import type { Id } from "../_generated/dataModel";

// The upload path enforces a per-plan storage ceiling (lib/plans.ts):
// Free = 100 MB, Lifetime = 10 GB. `createItem` / `addItemFiles` sum the
// incoming encrypted-blob sizes against the user's current footprint and throw
// `STORAGE_QUOTA_EXCEEDED` when the plan ceiling would be crossed. These tests
// pin that contract from both sides of the limit and across both plans.

const MB = 1024 * 1024;

async function seedVault(
  t: TestConvex,
  userId: Id<"users">,
): Promise<Id<"vaults">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function fileOf(storageId: StorageRef, size: number) {
  return {
    storageId,
    name: "blob.bin",
    mimeType: "application/octet-stream",
    size,
    iv: "aXY=",
    kind: "document" as const,
  };
}

async function createItemWithFile(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  size: number,
) {
  const storageId = await seedStorageRef(t);
  return asUser(t, userId).mutation(api.vault_items.createItem, {
    vaultId,
    category: "personal_document",
    encryptedTitle: JSON.stringify({ ciphertext: "dGl0bGU=", iv: "aXY=" }),
    encryptedContent: JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" }),
    accessLevel: "private",
    files: [fileOf(storageId, size)],
    _audit: await signedAudit(),
  });
}

describe("storage quota enforcement", () => {
  it("rejects an upload that exceeds the free 100 MB quota", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);

    await expect(
      createItemWithFile(t, userId, vaultId, 200 * MB),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
  });

  it("allows an upload within the free quota", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);

    const itemId = (await createItemWithFile(
      t,
      userId,
      vaultId,
      50 * MB,
    )) as Id<"vault_items">;

    const files = await t.run((ctx) =>
      ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(files).toHaveLength(1);
    expect(files[0].size).toBe(50 * MB);
  });

  it("allows a large upload for a lifetime user (10 GB ceiling)", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(userId, { plan: "lifetime" }));
    const vaultId = await seedVault(t, userId);

    const itemId = (await createItemWithFile(
      t,
      userId,
      vaultId,
      200 * MB,
    )) as Id<"vault_items">;

    const stored = await t.run((ctx) => ctx.db.get(itemId));
    expect(stored?.encryptedTitle).toBe(
      JSON.stringify({ ciphertext: "dGl0bGU=", iv: "aXY=" }),
    );
  });

  it("rejects an addItemFiles upload that would cross the free quota", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);

    // First attachment uses 80 MB of the 100 MB free quota.
    const itemId = (await createItemWithFile(
      t,
      userId,
      vaultId,
      80 * MB,
    )) as Id<"vault_items">;

    // A further 50 MB would total 130 MB > 100 MB → rejected.
    const storageId = await seedStorageRef(t);
    await expect(
      asUser(t, userId).mutation(api.vault_items.addItemFiles, {
        itemId,
        files: [fileOf(storageId, 50 * MB)],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
  });
});
