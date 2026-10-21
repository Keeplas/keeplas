import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  type TestConvex,
} from "./test.helpers";

async function seedItem(t: TestConvex, userId: Id<"users">) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const vaultId = await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return ctx.db.insert("vault_items", {
      vaultId,
      userId,
      encryptedMeta: "sealed-meta",
      encryptedContent: "sealed-content",
      encryptionType: "zero_knowledge",
      sharedWithContacts: [],
      accessLevel: "private",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedFile(
  t: TestConvex,
  userId: Id<"users">,
  itemId: Id<"vault_items">,
  file: { order: number; encryptedMeta?: string; kind?: "image" | "audio" },
) {
  const storageId = await seedStorageRef(t);
  await t.run((ctx) =>
    ctx.db.insert("vault_item_files", {
      itemId,
      userId,
      storageId,
      iv: "iv",
      createdAt: Date.now(),
      ...file,
    }),
  );
}

describe("getItemSummaries attachments", () => {
  it("returns each item's sealed file metadata in order", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const withFiles = await seedItem(t, owner);
    const noFiles = await seedItem(t, owner);
    await seedFile(t, owner, withFiles, { order: 1, encryptedMeta: "meta-b" });
    await seedFile(t, owner, withFiles, { order: 0, kind: "audio" });

    const summaries = await asUser(t, owner).query(
      api.vault_items.getItemSummaries,
      {},
    );
    const byId = new Map(summaries.map((s) => [s._id, s]));

    expect(byId.get(withFiles)?.files).toEqual([
      { kind: "audio" },
      { encryptedMeta: "meta-b" },
    ]);
    expect(byId.get(noFiles)?.files).toEqual([]);
  });

  it("never returns another user's attachments", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const other = await seedUser(t);
    await seedItem(t, owner);
    const otherItem = await seedItem(t, other);
    await seedFile(t, other, otherItem, { order: 0, encryptedMeta: "theirs" });

    const summaries = await asUser(t, owner).query(
      api.vault_items.getItemSummaries,
      {},
    );
    expect(summaries.flatMap((s) => s.files)).toEqual([]);
  });
});
