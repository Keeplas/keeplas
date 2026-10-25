import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getBlobSize } from "../lib/storage";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

const MB = 1024 * 1024;
const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

async function seedVault(t: TestConvex, userId: Id<"users">) {
  return t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    }),
  );
}

async function seedStoredBytes(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  bytes: number,
) {
  const storageId = await seedStorageRef(t);
  await t.run(async (ctx) => {
    const itemId = await ctx.db.insert("vault_items", {
      vaultId,
      userId,
      encryptedMeta: SEALED,
      encryptedContent: SEALED,
      encryptionType: "zero_knowledge",
      sharedWithContacts: [],
      accessLevel: "private",
      status: "active",
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("vault_item_files", {
      itemId,
      userId,
      storageId,
      iv: "aXY=",
      encryptedMeta: SEALED,
      sizeBucket: bytes,
      order: 0,
      createdAt: 0,
    });
  });
}

describe("storage room before an upload", () => {
  it("says whether the files fit in the plan", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const owner = asUser(t, userId);

    expect(
      (await owner.query(api.vaults.canStore, { bytes: 10 * MB })).fits,
    ).toBe(true);

    await seedStoredBytes(t, userId, vaultId, 95 * MB);
    const full = await owner.query(api.vaults.canStore, { bytes: 10 * MB });
    expect(full.fits).toBe(false);
    expect(full.usedBytes).toBe(95 * MB);
    expect(full.quotaBytes).toBe(100 * MB);
  });
});

describe("discarding refused uploads", () => {
  it("deletes blobs nobody claimed and keeps attached ones", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const owner = asUser(t, userId);
    const orphan = await seedStorageRef(t, 64);
    const attached = await seedStorageRef(t, 64);
    await owner.mutation(api.vault_items.createItem, {
      vaultId,
      encryptedMeta: SEALED,
      encryptedTitle: SEALED,
      encryptedContent: SEALED,
      accessLevel: "private",
      files: [{ storageId: attached, iv: "aXY=", encryptedMeta: SEALED }],
      _audit: await signedAudit(),
    });

    const result = await owner.mutation(api.vault_items.discardUploads, {
      storageIds: [orphan, attached],
      _audit: await signedAudit(),
    });

    expect(result.discarded).toBe(1);
    expect(await t.run((ctx) => getBlobSize(ctx, orphan))).toBeNull();
    expect(await t.run((ctx) => getBlobSize(ctx, attached))).not.toBeNull();
  });
});
