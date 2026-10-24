import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getBlobSize } from "../lib/storage";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

const sealed = (text: string) =>
  JSON.stringify({
    ciphertext: Buffer.from(text).toString("base64"),
    iv: "aXY=",
  });

async function seedOwner(t: TestConvex) {
  const userId = await seedUser(t);
  const vaultId = await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    }),
  );
  return { userId, vaultId };
}

async function createItem(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  files = 1,
) {
  const storageIds = await Promise.all(
    Array.from({ length: files }, () => seedStorageRef(t, 64)),
  );
  const itemId = (await asUser(t, userId).mutation(api.vault_items.createItem, {
    vaultId,
    encryptedMeta: sealed("meta"),
    encryptedTitle: sealed("Loan to Paul"),
    encryptedContent: sealed("Paul owes 500"),
    accessLevel: "private",
    files: storageIds.map((storageId) => ({
      storageId,
      iv: "aXY=",
      encryptedMeta: sealed("contract.pdf"),
    })),
    _audit: await signedAudit(),
  })) as Id<"vault_items">;
  return { itemId, storageIds };
}

async function filesOf(t: TestConvex, itemId: Id<"vault_items">) {
  return t.run((ctx) =>
    ctx.db
      .query("vault_item_files")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect(),
  );
}

describe("item history", () => {
  it("keeps the previous text and files when an item is edited", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const { itemId, storageIds } = await createItem(t, userId, vaultId);
    const [file] = await filesOf(t, itemId);

    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      encryptedContent: sealed("Paul paid back 500"),
      removeFileIds: [file._id],
      _audit: await signedAudit(),
    });

    const versions = await asUser(t, userId).query(
      api.vault_items.getItemVersions,
      { itemId },
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].encryptedContent).toBe(sealed("Paul owes 500"));
    expect(versions[0].files.map((f) => f.storageId)).toEqual(storageIds);
    expect(await filesOf(t, itemId)).toEqual([]);
    expect(
      await t.run((ctx) => getBlobSize(ctx, storageIds[0])),
    ).not.toBeNull();
    expect(
      await asUser(t, userId).query(api.vault_items.getVersionFileUrl, {
        versionId: versions[0]._id,
        storageId: storageIds[0],
      }),
    ).not.toBeNull();
  });

  it("does not record a version when only the key wraps change", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const { itemId } = await createItem(t, userId, vaultId, 0);

    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      ownerWrappedDek: "rewrapped",
      recipientKeys: [],
      _audit: await signedAudit(),
    });

    expect(
      await asUser(t, userId).query(api.vault_items.getItemVersions, {
        itemId,
      }),
    ).toEqual([]);
  });

  it("keeps a removed attachment in the history", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const { itemId, storageIds } = await createItem(t, userId, vaultId);
    const [file] = await filesOf(t, itemId);

    await asUser(t, userId).mutation(api.vault_items.removeItemFile, {
      itemId,
      fileId: file._id,
      _audit: await signedAudit(),
    });

    const [version] = await asUser(t, userId).query(
      api.vault_items.getItemVersions,
      { itemId },
    );
    expect(version.files.map((f) => f.storageId)).toEqual(storageIds);
    expect(
      await t.run((ctx) => getBlobSize(ctx, storageIds[0])),
    ).not.toBeNull();
  });

  it("restores a version and keeps the state it replaces", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const { itemId, storageIds } = await createItem(t, userId, vaultId);
    const [file] = await filesOf(t, itemId);
    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      encryptedContent: sealed("Paul paid back 500"),
      removeFileIds: [file._id],
      _audit: await signedAudit(),
    });
    const [first] = await asUser(t, userId).query(
      api.vault_items.getItemVersions,
      { itemId },
    );

    await asUser(t, userId).mutation(api.vault_items.restoreItemVersion, {
      itemId,
      versionId: first._id,
      _audit: await signedAudit(),
    });

    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item?.encryptedContent).toBe(sealed("Paul owes 500"));
    expect((await filesOf(t, itemId)).map((f) => f.storageId)).toEqual(
      storageIds,
    );
    const versions = await asUser(t, userId).query(
      api.vault_items.getItemVersions,
      { itemId },
    );
    expect(versions.map((v) => v.encryptedContent)).toEqual([
      sealed("Paul paid back 500"),
      sealed("Paul owes 500"),
    ]);
  });

  it("only shows an item's history to its owner", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const { itemId } = await createItem(t, userId, vaultId, 0);
    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      encryptedTitle: sealed("Loan to Paul (paid)"),
      _audit: await signedAudit(),
    });
    const [version] = await asUser(t, userId).query(
      api.vault_items.getItemVersions,
      { itemId },
    );
    const stranger = await seedUser(t);

    expect(
      await asUser(t, stranger).query(api.vault_items.getItemVersions, {
        itemId,
      }),
    ).toEqual([]);
    await expect(
      asUser(t, stranger).mutation(api.vault_items.restoreItemVersion, {
        itemId,
        versionId: version._id,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Item not found");
  });
});

describe("item archive", () => {
  it("moves an item out of the vault and back, untouched", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const contactId = await seedTrustContact(t, userId, { n: 1 });
    const { itemId, storageIds } = await createItem(t, userId, vaultId);
    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      sharedWithContacts: [contactId],
      recipientMode: "explicit",
      accessLevel: "trusted_only",
      recipientKeys: [{ contactId, wrappedDek: "wrapped" }],
      _audit: await signedAudit(),
    });

    await asUser(t, userId).mutation(api.vault_items.archiveItem, {
      itemId,
      _audit: await signedAudit(),
    });

    const owner = asUser(t, userId);
    expect(await owner.query(api.vault_items.getItemSummaries, {})).toEqual([]);
    const archived = await owner.query(api.vault_items.getArchivedItems, {});
    expect(archived.map((item) => item._id)).toEqual([itemId]);
    expect(archived[0].archivedAt).toBeTypeOf("number");
    const summary = await owner.query(
      api.trusted_contacts.getContactAccessSummary,
      { contactId },
    );
    expect(summary.releasedItems).toEqual([]);
    await expect(
      owner.mutation(api.vault_items.updateItem, {
        itemId,
        encryptedContent: sealed("edit"),
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Item is archived");
    expect(
      await t.run((ctx) => getBlobSize(ctx, storageIds[0])),
    ).not.toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(vaultId)))?.encryptedItemsCount,
    ).toBe(0);

    await owner.mutation(api.vault_items.unarchiveItem, {
      itemId,
      _audit: await signedAudit(),
    });

    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item?.status).toBe("active");
    expect(item?.archivedAt).toBeUndefined();
    expect(item?.sharedWithContacts).toEqual([contactId]);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("vault_item_recipient_keys")
          .withIndex("by_item", (q) => q.eq("itemId", itemId))
          .collect(),
      ),
    ).toHaveLength(1);
    expect(
      (await t.run((ctx) => ctx.db.get(vaultId)))?.encryptedItemsCount,
    ).toBe(1);
  });

  it("archives several items at once, only the owner's", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const first = await createItem(t, userId, vaultId);
    const second = await createItem(t, userId, vaultId);
    const kept = await createItem(t, userId, vaultId);
    const owner = asUser(t, userId);

    await owner.mutation(api.vault_items.archiveItems, {
      itemIds: [first.itemId, second.itemId],
      _audit: await signedAudit(),
    });

    const archived = await owner.query(api.vault_items.getArchivedItems, {});
    expect(archived.map((item) => item._id).sort()).toEqual(
      [first.itemId, second.itemId].sort(),
    );
    expect(
      (await owner.query(api.vault_items.getItemSummaries, {})).map(
        (item) => item._id,
      ),
    ).toEqual([kept.itemId]);
    expect(
      (await t.run((ctx) => ctx.db.get(vaultId)))?.encryptedItemsCount,
    ).toBe(1);

    const stranger = asUser(t, await seedUser(t));
    await expect(
      stranger.mutation(api.vault_items.archiveItems, {
        itemIds: [kept.itemId],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Item not found");
  });

  it("counts archives and history in the storage used", async () => {
    const t = makeT();
    const { userId, vaultId } = await seedOwner(t);
    const kept = await createItem(t, userId, vaultId);
    const edited = await createItem(t, userId, vaultId);
    const [file] = await filesOf(t, edited.itemId);
    const owner = asUser(t, userId);
    const before = await owner.query(api.vaults.getUsageStats, {});

    await owner.mutation(api.vault_items.archiveItem, {
      itemId: kept.itemId,
      _audit: await signedAudit(),
    });
    await owner.mutation(api.vault_items.removeItemFile, {
      itemId: edited.itemId,
      fileId: file._id,
      _audit: await signedAudit(),
    });

    const after = await owner.query(api.vaults.getUsageStats, {});
    expect(after.storageBytes).toBe(before.storageBytes);
    expect(after.archiveBytes).toBe(before.storageBytes);
  });
});
