import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  makeT,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Former v2 folders: no sharing any more (access is set per item); the
// owner's phone turns each one into a vault category.

const SEALED = JSON.stringify({ ciphertext: "c2VhbGVk", iv: "aXY=" });

async function setup() {
  const t = makeT();
  const ownerId = await seedUser(t);
  const owner = asUser(t, ownerId);
  const contactId = await seedTrustContact(t, ownerId, { n: 1 });

  const folderId = await t.run((ctx) =>
    ctx.db.insert("folders", {
      userId: ownerId,
      encryptedName: SEALED,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const itemIds = await t.run(async (ctx) => {
    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      userId: ownerId,
      encryptedItemsCount: 3,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const make = (folder?: Id<"folders">, accessLevel = "private" as const) =>
      ctx.db.insert("vault_items", {
        vaultId,
        userId: ownerId,
        folderId: folder,
        encryptedMeta: SEALED,
        encryptedContent: SEALED,
        encryptionType: "zero_knowledge",
        ownerWrappedDek: "owner-dek",
        sharedWithContacts: [],
        accessLevel,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    return {
      inFolder: await make(folderId),
      other: await make(),
    };
  });
  return { t, ownerId, owner, contactId, folderId, itemIds };
}

function keysFor(t: TestConvex, contactId: Id<"trusted_contacts">) {
  return t.run((ctx) =>
    ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect(),
  );
}

describe("folders", () => {
  it("lists the owner's folders with their item counts", async () => {
    const s = await setup();
    const [category] = await s.owner.query(api.folders.list, {});
    expect(category).toMatchObject({
      _id: s.folderId,
      encryptedName: SEALED,
      itemCount: 1,
    });
  });

  it("deleting a folder keeps its items", async () => {
    const s = await setup();
    await s.owner.mutation(api.folders.remove, {
      folderId: s.folderId,
      _audit: await signedAudit(),
    });
    expect(await s.owner.query(api.folders.list, {})).toEqual([]);
    const item = await s.t.run((ctx) => ctx.db.get(s.itemIds.inFolder));
    expect(item?.folderId).toBeUndefined();
  });

  it("someone else cannot change the folder", async () => {
    const s = await setup();
    const intruder = asUser(s.t, await seedUser(s.t));
    await expect(
      intruder.mutation(api.folders.remove, {
        folderId: s.folderId,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Folder not found");
  });
});

describe("folders become categories", () => {
  it("adopts a folder as a category once, with the same sealed name", async () => {
    const s = await setup();
    const adopt = async () =>
      s.owner.mutation(api.folders.adopt, {
        folderId: s.folderId,
        _audit: await signedAudit(),
      });
    const categoryId = await adopt();
    expect(await adopt()).toBe(categoryId);
    expect(await s.owner.query(api.vault_categories.list, {})).toMatchObject([
      { _id: categoryId, encryptedName: SEALED },
    ]);
  });

  it("moves an item's category into its sealed metadata", async () => {
    const s = await setup();
    await s.owner.mutation(api.folders.migrateItem, {
      itemId: s.itemIds.inFolder,
      encryptedMeta: "meta-with-category",
      _audit: await signedAudit(),
    });
    const item = await s.t.run((ctx) => ctx.db.get(s.itemIds.inFolder));
    expect(item).toMatchObject({ encryptedMeta: "meta-with-category" });
    expect(item?.folderId).toBeUndefined();
    await expect(
      s.owner.mutation(api.folders.migrateItem, {
        itemId: s.itemIds.other,
        encryptedMeta: "x",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("not in a folder");
  });
});

describe("migrations.dropFolderGrants", () => {
  async function seedGrant(
    s: Awaited<ReturnType<typeof setup>>,
    itemId: Id<"vault_items">,
  ) {
    await s.t.run(async (ctx) => {
      await ctx.db.insert("folder_grants", {
        folderId: s.folderId,
        ownerId: s.ownerId,
        contactId: s.contactId,
        timing: "now",
        sealedName: "sealed-for-contact",
        createdAt: Date.now(),
      });
      await ctx.db.insert("vault_item_recipient_keys", {
        itemId,
        contactId: s.contactId,
        wrappedDek: "dek-for-contact",
        createdAt: Date.now(),
      });
    });
  }

  it("ends folder access and drops the wraps it gave", async () => {
    const s = await setup();
    await seedGrant(s, s.itemIds.inFolder);
    expect(await s.t.mutation(internal.migrations.dropFolderGrants, {})).toBe(
      1,
    );
    expect(
      await s.t.run((ctx) => ctx.db.query("folder_grants").collect()),
    ).toEqual([]);
    expect(await keysFor(s.t, s.contactId)).toEqual([]);
  });

  it("keeps the wrap of an item the contact still receives", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.patch(s.itemIds.inFolder, { accessLevel: "trusted_only" }),
    );
    await seedGrant(s, s.itemIds.inFolder);
    await s.t.mutation(internal.migrations.dropFolderGrants, {});
    expect((await keysFor(s.t, s.contactId)).length).toBe(1);
  });
});
