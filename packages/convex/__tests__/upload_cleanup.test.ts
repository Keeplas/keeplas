import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  getBlobSize,
  type StorageRef,
  UNCLAIMED_BLOB_TTL_MS,
  UPLOAD_URLS_PER_HOUR,
} from "../lib/storage";
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

describe("abandoned uploads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createItemWith = async (
    t: TestConvex,
    userId: Id<"users">,
    vaultId: Id<"vaults">,
    storageId: StorageRef,
  ) =>
    asUser(t, userId).mutation(api.vault_items.createItem, {
      vaultId,
      encryptedMeta: SEALED,
      encryptedTitle: SEALED,
      encryptedContent: SEALED,
      accessLevel: "private",
      files: [{ storageId, iv: "aXY=", encryptedMeta: SEALED }],
      _audit: await signedAudit(),
    });

  it("throttles upload URLs per account, vault files and avatar alike", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const owner = asUser(t, userId);
    const _audit = await signedAudit();

    for (let i = 0; i < UPLOAD_URLS_PER_HOUR - 1; i++) {
      await owner.mutation(api.vault_items.generateUploadUrl, { _audit });
    }
    await owner.mutation(api.users.generateAvatarUploadUrl, {});

    await expect(
      owner.mutation(api.vault_items.generateUploadUrl, { _audit }),
    ).rejects.toThrow("Too many requests");
    await expect(
      owner.mutation(api.users.generateAvatarUploadUrl, {}),
    ).rejects.toThrow("Too many requests");

    // Another account keeps its own budget.
    const other = await seedUser(t);
    await expect(
      asUser(t, other).mutation(api.vault_items.generateUploadUrl, { _audit }),
    ).resolves.toBeTypeOf("string");
  });

  it("neither discards nor attaches an unowned blob older than the upload window", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    // A blob attached before owner binding existed has no owner row either.
    const legacy = await seedStorageRef(t, 64);
    vi.advanceTimersByTime(UNCLAIMED_BLOB_TTL_MS + 1);

    const result = await asUser(t, userId).mutation(
      api.vault_items.discardUploads,
      { storageIds: [legacy], _audit: await signedAudit() },
    );
    expect(result.discarded).toBe(0);
    expect(await t.run((ctx) => getBlobSize(ctx, legacy))).not.toBeNull();

    await expect(createItemWith(t, userId, vaultId, legacy)).rejects.toThrow(
      "Uploaded file not found",
    );
  });

  it("sweeps blobs never attached within the window, keeping attached and legacy ones", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    // Uploaded before owner binding went live (no storage_blobs row yet).
    const legacy = await seedStorageRef(t, 64);
    vi.advanceTimersByTime(60_000);
    const attached = await seedStorageRef(t, 64);
    await createItemWith(t, userId, vaultId, attached);
    vi.advanceTimersByTime(60_000);
    const orphan = await seedStorageRef(t, 64);
    vi.advanceTimersByTime(UNCLAIMED_BLOB_TTL_MS);
    // Still inside its window: the client may attach it yet.
    const recent = await seedStorageRef(t, 64);
    vi.advanceTimersByTime(60_000);

    await t.mutation(internal.vault_items.sweepUnclaimedUploads, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const exists = (ref: StorageRef) =>
      t.run(async (ctx) => (await getBlobSize(ctx, ref)) !== null);
    expect(await exists(orphan)).toBe(false);
    expect(await exists(attached)).toBe(true);
    expect(await exists(legacy)).toBe(true);
    expect(await exists(recent)).toBe(true);
  });
});
