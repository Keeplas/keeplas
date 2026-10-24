import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getBlobDownloadUrl, type StorageRef } from "../lib/storage";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// A storage handle is not a secret: a released contact sees the file rows of
// the items left to them. Every blob is bound to the account that first
// attaches it (`storage_blobs`), so nobody else can attach it — and later
// delete it through their own avatar or account wipe.

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

async function seedVault(t: TestConvex, userId: Id<"users">) {
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

async function createItemWith(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  storageId: StorageRef,
) {
  return (await asUser(t, userId).mutation(api.vault_items.createItem, {
    vaultId,
    encryptedMeta: SEALED,
    encryptedTitle: SEALED,
    encryptedContent: SEALED,
    accessLevel: "private",
    files: [{ storageId, iv: "aXY=", encryptedMeta: SEALED }],
    _audit: await signedAudit(),
  })) as Id<"vault_items">;
}

/** An owner with one attached file, and another account knowing its handle. */
async function seedOwnerFile(t: TestConvex) {
  const owner = await seedUser(t);
  const storageId = await seedStorageRef(t, 64);
  await createItemWith(t, owner, await seedVault(t, owner), storageId);
  const intruder = await seedUser(t);
  return { owner, storageId, intruder };
}

const blobExists = (t: TestConvex, storageId: StorageRef) =>
  t.run(async (ctx) => (await getBlobDownloadUrl(ctx, storageId)) !== null);

const blobOwners = (t: TestConvex) =>
  t.run((ctx) => ctx.db.query("storage_blobs").collect());

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("blob ownership", () => {
  it("refuses another account's blob as an avatar, so removing it can't delete the file", async () => {
    const t = makeT();
    const { storageId, intruder } = await seedOwnerFile(t);

    await expect(
      asUser(t, intruder).mutation(api.users.setAvatarImage, {
        storageId,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Uploaded image could not be resolved");
    await asUser(t, intruder).mutation(api.users.removeAvatar, {
      _audit: await signedAudit(),
    });

    expect(await blobExists(t, storageId)).toBe(true);
  });

  it("refuses another account's blob on a new item", async () => {
    const t = makeT();
    const { storageId, intruder } = await seedOwnerFile(t);

    await expect(
      createItemWith(t, intruder, await seedVault(t, intruder), storageId),
    ).rejects.toThrow("Uploaded file not found");
  });

  it("refuses another account's blob on an existing item", async () => {
    const t = makeT();
    const { storageId, intruder } = await seedOwnerFile(t);
    const intruderItem = await createItemWith(
      t,
      intruder,
      await seedVault(t, intruder),
      await seedStorageRef(t, 8),
    );

    await expect(
      asUser(t, intruder).mutation(api.vault_items.addItemFiles, {
        itemId: intruderItem,
        files: [{ storageId, iv: "aXY=", encryptedMeta: SEALED }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Uploaded file not found");
  });

  it("lets the owner attach their blob again (a retried save)", async () => {
    const t = makeT();
    const { owner, storageId } = await seedOwnerFile(t);

    await expect(
      createItemWith(t, owner, await seedVault(t, owner), storageId),
    ).resolves.toBeDefined();
    expect(await blobOwners(t)).toMatchObject([{ storageRef: storageId }]);
  });

  it("drops the account's blobs and their owner rows when it is wiped", async () => {
    const t = makeT();
    const { owner, storageId } = await seedOwnerFile(t);

    await t.mutation(internal.account_deletion.wipeStep, { userId: owner });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await blobExists(t, storageId)).toBe(false);
    expect(await blobOwners(t)).toEqual([]);
  });
});

describe("avatar", () => {
  it("resolves the avatar URL when read instead of storing it", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const storageId = await seedStorageRef(t, 16);

    const url = await asUser(t, userId).mutation(api.users.setAvatarImage, {
      storageId,
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(userId));
    expect(row?.avatarUrl).toBeUndefined();
    expect(row?.avatarStorageId).toBe(storageId);
    const viewer = await asUser(t, userId).query(api.users.viewer, {});
    expect(viewer?.avatarUrl).toBe(url);
  });
});

describe("blob owner backfill", () => {
  /** Rows written before `storage_blobs` existed: no owner bound yet. */
  async function seedLegacyRows(t: TestConvex, userId: Id<"users">) {
    const fileBlob = await seedStorageRef(t, 8);
    const versionBlob = await seedStorageRef(t, 8);
    const avatarBlob = await seedStorageRef(t, 8);
    await t.run(async (ctx) => {
      const now = Date.now();
      const itemId = await ctx.db.insert("vault_items", {
        vaultId: await ctx.db.insert("vaults", {
          userId,
          encryptedItemsCount: 1,
          lastVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
        userId,
        encryptedMeta: SEALED,
        encryptedContent: SEALED,
        encryptionType: "zero_knowledge",
        sharedWithContacts: [],
        accessLevel: "private",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("vault_item_files", {
        itemId,
        userId,
        storageId: fileBlob,
        iv: "aXY=",
        encryptedMeta: SEALED,
        sizeBucket: 4096,
        order: 0,
        createdAt: now,
      });
      await ctx.db.insert("vault_item_versions", {
        itemId,
        userId,
        encryptedContent: SEALED,
        files: [{ storageId: versionBlob, iv: "aXY=", order: 0 }],
        savedAt: now,
        replacedAt: now,
      });
      await ctx.db.patch(userId, { avatarStorageId: avatarBlob });
    });
    return { fileBlob, versionBlob, avatarBlob };
  }

  it("binds every attached blob to its owner", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const { fileBlob, versionBlob, avatarBlob } = await seedLegacyRows(
      t,
      owner,
    );

    await t.mutation(internal.migrations.backfillBlobOwners, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const owners = await blobOwners(t);
    expect(owners.map((row) => row.storageRef).sort()).toEqual(
      [fileBlob, versionBlob, avatarBlob].sort(),
    );
    expect(owners.every((row) => row.userId === owner)).toBe(true);
    const intruder = await seedUser(t);
    await expect(
      createItemWith(t, intruder, await seedVault(t, intruder), versionBlob),
    ).rejects.toThrow("Uploaded file not found");
  });

  it("keeps the first holder of a shared blob, whose file outlives the other account's wipe", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const { fileBlob } = await seedLegacyRows(t, owner);
    // Attached by a second account before ownership was enforced.
    const intruder = await seedUser(t);
    await t.run(async (ctx) => {
      const [file] = await ctx.db.query("vault_item_files").collect();
      const { _id, _creationTime, ...row } = file;
      await ctx.db.insert("vault_item_files", { ...row, userId: intruder });
    });

    await t.mutation(internal.migrations.backfillBlobOwners, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.account_deletion.wipeStep, { userId: intruder });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await blobExists(t, fileBlob)).toBe(true);
    expect(await blobOwners(t)).toContainEqual(
      expect.objectContaining({ storageRef: fileBlob, userId: owner }),
    );
  });
});
