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
import { sizeBucket } from "../lib/storage";
import type { Id } from "../_generated/dataModel";

// The upload path enforces a per-plan storage ceiling (lib/plans.ts):
// Free = 100 MB, Lifetime = 10 GB. Since F4 the server measures each stored
// blob itself (the client sends no size) and counts its size bucket, so a
// client can neither leak nor under-report the exact size.

const MB = 1024 * 1024;
const META = JSON.stringify({ ciphertext: "bWV0YQ==", iv: "aXY=" });

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

/** Existing usage: one active item with a file of `bytes` (bucketed). */
async function seedUsage(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  bytes: number,
  kind?: "document" | "audio" | "video" | "image",
) {
  const storageId = await seedStorageRef(t);
  await t.run(async (ctx) => {
    const now = Date.now();
    const itemId = await ctx.db.insert("vault_items", {
      vaultId,
      userId,
      encryptedMeta: META,
      encryptedContent: META,
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
      storageId,
      iv: "aXY=",
      encryptedMeta: META,
      sizeBucket: bytes,
      kind,
      order: 0,
      createdAt: now,
    });
  });
}

async function createItemWithFile(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  blobBytes = 1,
) {
  const storageId = await seedStorageRef(t, blobBytes);
  return asUser(t, userId).mutation(api.vault_items.createItem, {
    vaultId,
    encryptedMeta: META,
    encryptedTitle: JSON.stringify({ ciphertext: "dGl0bGU=", iv: "aXY=" }),
    encryptedContent: JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" }),
    accessLevel: "private",
    files: [{ storageId, iv: "aXY=", encryptedMeta: META }],
    _audit: await signedAudit(),
  });
}

describe("storage quota enforcement", () => {
  it("rejects an upload that would cross the free 100 MB quota", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    await seedUsage(t, userId, vaultId, 100 * MB - 1000);

    await expect(createItemWithFile(t, userId, vaultId)).rejects.toThrow(
      "STORAGE_QUOTA_EXCEEDED",
    );
  });

  it("stores the measured size bucket and no plaintext name, type or size", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);

    const itemId = (await createItemWithFile(
      t,
      userId,
      vaultId,
      70_000,
    )) as Id<"vault_items">;

    const [file] = await t.run((ctx) =>
      ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(file.sizeBucket).toBe(sizeBucket(70_000));
    expect(file.encryptedMeta).toBe(META);
    expect(file.name).toBeUndefined();
    expect(file.mimeType).toBeUndefined();
    expect(file.size).toBeUndefined();
    expect(file.kind).toBeUndefined();
    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item?.category).toBeUndefined();
  });

  it("allows more usage for a lifetime user (10 GB ceiling)", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await t.run((ctx) => ctx.db.patch(userId, { plan: "lifetime" }));
    const vaultId = await seedVault(t, userId);
    await seedUsage(t, userId, vaultId, 200 * MB);

    await expect(createItemWithFile(t, userId, vaultId)).resolves.toBeDefined();
  });

  it("counts files on release introductions, so flipping an item in and out of intro mode frees nothing", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const intro = await seedStorageRef(t, 60 * MB);
    const itemId = (await asUser(t, userId).mutation(
      api.vault_items.createItem,
      {
        vaultId,
        encryptedMeta: META,
        encryptedTitle: META,
        encryptedContent: META,
        accessLevel: "trusted_only",
        isReleaseIntroduction: true,
        files: [{ storageId: intro, iv: "aXY=", encryptedMeta: META }],
        _audit: await signedAudit(),
      },
    )) as Id<"vault_items">;

    // A second 60 MB upload no longer fits the free 100 MB.
    await expect(
      createItemWithFile(t, userId, vaultId, 60 * MB),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");

    // Turning the intro into a normal item keeps the same usage.
    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      isReleaseIntroduction: false,
      accessLevel: "private",
      _audit: await signedAudit(),
    });
    const usage = await asUser(t, userId).query(api.vaults.canStore, {
      bytes: 1,
    });
    expect(usage.usedBytes).toBe(sizeBucket(60 * MB));
  });

  it("rejects an addItemFiles upload that would cross the free quota", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const itemId = (await createItemWithFile(
      t,
      userId,
      vaultId,
    )) as Id<"vault_items">;
    await seedUsage(t, userId, vaultId, 100 * MB - 5000);

    const storageId = await seedStorageRef(t, 2);
    await expect(
      asUser(t, userId).mutation(api.vault_items.addItemFiles, {
        itemId,
        files: [{ storageId, iv: "aXY=", encryptedMeta: META }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
  });
});

describe("usage stats", () => {
  it("splits stored bytes by file kind, legacy files counting as documents", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    await seedUsage(t, userId, vaultId, 3 * MB, "image");
    await seedUsage(t, userId, vaultId, 2 * MB, "audio");
    await seedUsage(t, userId, vaultId, 1 * MB);

    const usage = await asUser(t, userId).query(api.vaults.getUsageStats, {});
    expect(usage.storageBytes).toBe(6 * MB);
    expect(usage.bytesByKind).toEqual({
      document: 1 * MB,
      image: 3 * MB,
      audio: 2 * MB,
      video: 0,
    });
  });
});

describe("size buckets", () => {
  it("hides the exact size and overcounts by at most 6.25 %", () => {
    expect(sizeBucket(1)).toBe(4096);
    for (const n of [5000, 70_000, 1_234_567, 987_654_321]) {
      const b = sizeBucket(n);
      expect(b).toBeGreaterThanOrEqual(n);
      expect(b / n).toBeLessThanOrEqual(1.0625);
    }
    expect(sizeBucket(1_000_001)).toBe(sizeBucket(1_000_002));
  });
});
