import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  makeT,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

async function seedOwner(t: TestConvex) {
  const userId = await seedUser(t);
  const now = Date.now();
  const [vaultId, folderId] = await t.run(async (ctx) => [
    await ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    await ctx.db.insert("folders", {
      userId,
      encryptedName: SEALED,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
  return { userId, vaultId, folderId };
}

function create(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  extra: {
    folderId?: Id<"folders">;
    recipientKeys?: { contactId: Id<"trusted_contacts">; wrappedDek: string }[];
  },
) {
  return signedAudit().then((_audit) =>
    asUser(t, userId).mutation(api.vault_items.createItem, {
      vaultId,
      encryptedMeta: SEALED,
      encryptedTitle: SEALED,
      encryptedContent: SEALED,
      accessLevel: "private",
      encryptionType: "zero_knowledge",
      ownerWrappedDek: "owner-dek",
      ...extra,
      _audit,
    }),
  );
}

describe("createItem into a folder", () => {
  it("files the item in the owner's folder with the grantees' keys", async () => {
    const t = makeT();
    const { userId, vaultId, folderId } = await seedOwner(t);
    const contactId = await seedTrustContact(t, userId, { n: 1 });

    const itemId = await create(t, userId, vaultId, {
      folderId,
      recipientKeys: [{ contactId, wrappedDek: "for-marie" }],
    });

    const [item, keys] = await t.run(async (ctx) => [
      await ctx.db.get(itemId),
      await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    ]);
    expect(item?.folderId).toBe(folderId);
    expect(keys.map((k) => k.contactId)).toEqual([contactId]);
  });

  it("refuses a folder that belongs to someone else", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const other = await seedOwner(t);
    await expect(
      create(t, owner.userId, owner.vaultId, { folderId: other.folderId }),
    ).rejects.toThrow("Folder not found");
  });

  it("refuses a recipient key for a contact that is not the owner's", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const other = await seedOwner(t);
    const stranger = await seedTrustContact(t, other.userId, { n: 2 });
    await expect(
      create(t, owner.userId, owner.vaultId, {
        recipientKeys: [{ contactId: stranger, wrappedDek: "x" }],
      }),
    ).rejects.toThrow("not yours");
  });
});

describe("updateItem recipients", () => {
  it("shares an item with the owner's contact", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    const itemId = await create(t, owner.userId, owner.vaultId, {});

    await asUser(t, owner.userId).mutation(api.vault_items.updateItem, {
      itemId,
      sharedWithContacts: [contactId],
      recipientKeys: [{ contactId, wrappedDek: "for-marie" }],
      _audit: await signedAudit(),
    });

    const keys = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(keys.map((k) => k.contactId)).toEqual([contactId]);
  });

  it("refuses a contact that is not the owner's", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const other = await seedOwner(t);
    const stranger = await seedTrustContact(t, other.userId, { n: 2 });
    const itemId = await create(t, owner.userId, owner.vaultId, {});

    await expect(
      asUser(t, owner.userId).mutation(api.vault_items.updateItem, {
        itemId,
        recipientKeys: [{ contactId: stranger, wrappedDek: "x" }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("not yours");
  });
});
