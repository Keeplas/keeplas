import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  signedAudit,
} from "./test.helpers";
import { sizeBucket } from "../lib/storage";

// Phase 6 (F4): legacy rows carry a plaintext category, file name, MIME type
// and size. The owner's client seals them into `encryptedMeta`; the server
// then drops the plaintext and keeps only a size bucket.

const SEALED = JSON.stringify({ ciphertext: "c2VhbGVk", iv: "aXY=" });

async function seedLegacy() {
  const t = makeT();
  const userId = await seedUser(t);
  const storageId = await seedStorageRef(t, 70_000);
  const { itemId, fileId } = await t.run(async (ctx) => {
    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 1,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const itemId = await ctx.db.insert("vault_items", {
      vaultId,
      userId,
      category: "health_directive",
      encryptedContent: SEALED,
      encryptionType: "zero_knowledge",
      ownerWrappedDek: "dek",
      sharedWithContacts: [],
      accessLevel: "private",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const fileId = await ctx.db.insert("vault_item_files", {
      itemId,
      userId,
      storageId,
      name: "scan.pdf",
      mimeType: "application/pdf",
      size: 69_990,
      kind: "document",
      iv: "aXY=",
      order: 0,
      createdAt: now,
    });
    return { itemId, fileId };
  });
  return { t, userId, itemId, fileId, as: asUser(t, userId) };
}

describe("metadata backfill", () => {
  it("lists legacy plaintext metadata for the owner's client", async () => {
    const { as, itemId, fileId } = await seedLegacy();
    expect(
      await as.query(api.vault_items.getItemsNeedingMetaBackfill, {}),
    ).toEqual([
      {
        itemId,
        encryptionType: "zero_knowledge",
        ownerWrappedDek: "dek",
        category: "health_directive",
        files: [
          {
            fileId,
            name: "scan.pdf",
            mimeType: "application/pdf",
            size: 69_990,
            kind: "document",
            durationSec: undefined,
          },
        ],
      },
    ]);
  });

  it("seals the metadata and drops every plaintext column", async () => {
    const { t, as, itemId, fileId } = await seedLegacy();
    expect(
      await t.query(internal.vault_items.countPlaintextMetadata, {}),
    ).toEqual({ items: 1, files: 1 });

    await as.mutation(api.vault_items.backfillItemMeta, {
      itemId,
      encryptedMeta: SEALED,
      files: [{ fileId, encryptedMeta: SEALED }],
      _audit: await signedAudit(),
    });

    const item = await t.run((ctx) => ctx.db.get(itemId));
    const file = await t.run((ctx) => ctx.db.get(fileId));
    expect(item?.category).toBeUndefined();
    expect(item?.encryptedMeta).toBe(SEALED);
    expect(file).toMatchObject({
      encryptedMeta: SEALED,
      sizeBucket: sizeBucket(70_000),
    });
    for (const field of ["name", "mimeType", "size", "kind"] as const) {
      expect(file?.[field]).toBeUndefined();
    }
    expect(
      await t.query(internal.vault_items.countPlaintextMetadata, {}),
    ).toEqual({ items: 0, files: 0 });
    expect(
      await as.query(api.vault_items.getItemsNeedingMetaBackfill, {}),
    ).toEqual([]);
  });

  it("refuses another user's item", async () => {
    const { t, itemId, fileId } = await seedLegacy();
    const other = await seedUser(t);
    await expect(
      asUser(t, other).mutation(api.vault_items.backfillItemMeta, {
        itemId,
        encryptedMeta: SEALED,
        files: [{ fileId, encryptedMeta: SEALED }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow();
  });
});
