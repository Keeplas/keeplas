import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { storedFileBytes, sizeBucket } from "../lib/storage";
import {
  itemBytes,
  recipientKeyBytes,
  versionBytes,
} from "../lib/storage_usage";
import {
  asUser,
  makeT,
  runDueJobs,
  seedStorageRef,
  seedTrustContact,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// The storage quota counts everything an owner stores (item text, edit
// history, recipient-key rows and file blobs), from a per-user counter kept
// in step by every write: computing it never reads item or version
// documents. Items shared with the owner by someone else never count.

const KB = 1024;
const MB = 1024 * KB;
const WRAP = "w".repeat(1_600);

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
  owner: { userId: Id<"users">; vaultId: Id<"vaults"> },
  opts: {
    content?: string;
    files?: number;
    recipientKeys?: { contactId: Id<"trusted_contacts">; wrappedDek: string }[];
  } = {},
) {
  const storageIds = await Promise.all(
    Array.from({ length: opts.files ?? 0 }, () => seedStorageRef(t, 64)),
  );
  return (await asUser(t, owner.userId).mutation(api.vault_items.createItem, {
    vaultId: owner.vaultId,
    encryptedMeta: sealed("meta"),
    encryptedTitle: sealed("Loan to Paul"),
    encryptedContent: sealed(opts.content ?? "Paul owes 500"),
    accessLevel: opts.recipientKeys ? "trusted_only" : "private",
    encryptionType: "zero_knowledge",
    ownerWrappedDek: WRAP,
    recipientMode: opts.recipientKeys ? "explicit" : undefined,
    sharedWithContacts: opts.recipientKeys?.map((rk) => rk.contactId),
    recipientKeys: opts.recipientKeys,
    files: storageIds.map((storageId) => ({
      storageId,
      iv: "aXY=",
      encryptedMeta: sealed("contract.pdf"),
    })),
    _audit: await signedAudit(),
  })) as Id<"vault_items">;
}

async function editContent(
  t: TestConvex,
  userId: Id<"users">,
  itemId: Id<"vault_items">,
  content: string,
) {
  return asUser(t, userId).mutation(api.vault_items.updateItem, {
    itemId,
    encryptedContent: sealed(content),
    _audit: await signedAudit(),
  });
}

async function counter(t: TestConvex, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("storage_usage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
  );
}

/**
 * Independent recount from every stored document: what the counter must
 * equal. Recipient keys count as active whatever their item's status; a file
 * blob counts once per item, where its live row is, else in the history.
 */
async function recount(t: TestConvex, userId: Id<"users">) {
  let activeBytes = 0;
  let archiveBytes = 0;
  const items = await t.run(async (ctx) => {
    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const item of items) {
      const files = await ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      const keys = await ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      out.push({ item, files, keys });
    }
    return out;
  });
  for (const { item, files, keys } of items) {
    const own =
      (item.storedBytes ?? itemBytes(item)) +
      files.reduce((sum, f) => sum + storedFileBytes(f), 0);
    if (item.status === "archived") archiveBytes += own;
    else activeBytes += own;
    for (const key of keys) activeBytes += recipientKeyBytes(key);
    const seen = new Set<string>(files.map((f) => f.storageId));
    // A page of history per transaction: it can exceed one read.
    let after = 0;
    for (;;) {
      const page = await t.run((ctx) =>
        ctx.db
          .query("vault_item_versions")
          .withIndex("by_item", (q) =>
            q.eq("itemId", item._id).gt("_creationTime", after),
          )
          .take(4),
      );
      if (page.length === 0) break;
      for (const version of page) {
        archiveBytes += versionBytes(version);
        for (const file of version.files) {
          if (seen.has(file.storageId)) continue;
          seen.add(file.storageId);
          archiveBytes += storedFileBytes(file);
        }
      }
      after = page[page.length - 1]._creationTime;
    }
  }
  return { activeBytes, archiveBytes };
}

async function expectCounterMatches(t: TestConvex, userId: Id<"users">) {
  const row = await counter(t, userId);
  expect(row?.backfill).toBeUndefined();
  const expected = await recount(t, userId);
  expect({
    activeBytes: row?.activeBytes,
    archiveBytes: row?.archiveBytes,
  }).toEqual(expected);
}

async function itemDoc(t: TestConvex, itemId: Id<"vault_items">) {
  return (await t.run((ctx) => ctx.db.get(itemId))) as Doc<"vault_items">;
}

/** Put the owner's counter at `bytes` of active usage (e.g. near quota). */
async function setActiveBytes(
  t: TestConvex,
  userId: Id<"users">,
  bytes: number,
) {
  const row = await counter(t, userId);
  await t.run((ctx) => ctx.db.patch(row!._id, { activeBytes: bytes }));
}

describe("storage usage counts everything the owner stores", () => {
  it("includes item text, edit history, recipient keys and files", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    const itemId = await createItem(t, owner, {
      files: 1,
      recipientKeys: [{ contactId, wrappedDek: WRAP }],
    });
    await editContent(t, owner.userId, itemId, "Paul paid back 500");

    const item = await itemDoc(t, itemId);
    const [version] = await t.run((ctx) =>
      ctx.db
        .query("vault_item_versions")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    const [key] = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    const usage = await asUser(t, owner.userId).query(
      api.vaults.getUsageStats,
      {},
    );
    expect(item.storedBytes).toBe(itemBytes(item));
    expect(usage.storageBytes).toBe(
      itemBytes(item) +
        sizeBucket(64) +
        recipientKeyBytes(key) +
        versionBytes(version),
    );
    expect(usage.archiveBytes).toBe(versionBytes(version));
    await expectCounterMatches(t, owner.userId);
  });

  it("does not count items other people shared with me", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const me = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    await t.run((ctx) => ctx.db.patch(contactId, { contactUserId: me.userId }));
    await createItem(t, owner, {
      content: "x".repeat(50 * KB),
      recipientKeys: [{ contactId, wrappedDek: WRAP }],
    });
    await createItem(t, me);

    const mine = await asUser(t, me.userId).query(api.vaults.getUsageStats, {});
    const myItem = (await t.run((ctx) =>
      ctx.db
        .query("vault_items")
        .withIndex("by_user", (q) => q.eq("userId", me.userId))
        .unique(),
    ))!;
    expect(mine.storageBytes).toBe(itemBytes(myItem));
  });
});

describe("storage quota on text writes", () => {
  it("refuses a text edit past the quota but allows a shrinking one", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const itemId = await createItem(t, owner, { content: "x".repeat(8 * KB) });
    // 12 KB left: the edit keeps the 8 KB note as history.
    await setActiveBytes(t, owner.userId, 100 * MB - 12 * KB);

    await expect(
      editContent(t, owner.userId, itemId, "x".repeat(16 * KB)),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
    await expect(
      editContent(t, owner.userId, itemId, "short"),
    ).resolves.toBeNull();
  });

  it("refuses a new text item past the quota", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await createItem(t, owner);
    await setActiveBytes(t, owner.userId, 100 * MB - 1 * KB);

    await expect(
      createItem(t, owner, { content: "x".repeat(4 * KB) }),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
  });

  it("counts recipient keys but never refuses them past the quota", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    const itemId = await createItem(t, owner);
    await t.run((ctx) =>
      ctx.db.patch(itemId, { pendingRecipients: [contactId] }),
    );
    await setActiveBytes(t, owner.userId, 100 * MB - 100);

    await asUser(t, owner.userId).mutation(api.vault_items.addRecipientKeys, {
      itemId,
      recipientKeys: [{ contactId, wrappedDek: WRAP }],
      _audit: await signedAudit(),
    });
    const keys = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item_contact", (q) =>
          q.eq("itemId", itemId).eq("contactId", contactId),
        )
        .collect(),
    );
    expect(keys).toHaveLength(1);
    const usage = await t.run((ctx) =>
      ctx.db
        .query("storage_usage")
        .withIndex("by_user", (q) => q.eq("userId", owner.userId))
        .first(),
    );
    expect(usage!.activeBytes).toBeGreaterThan(100 * MB - 100);
  });

  it("lets an owner over quota read, archive, restore from archive, re-share and re-key", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    const itemId = await createItem(t, owner, {
      recipientKeys: [{ contactId, wrappedDek: WRAP }],
    });
    await setActiveBytes(t, owner.userId, 101 * MB);
    const as = asUser(t, owner.userId);

    expect(await as.query(api.vault_items.getItem, { itemId })).not.toBeNull();
    // Rotation re-wraps the DEK: same-size wraps, no content edit.
    await as.mutation(api.vault_items.updateItem, {
      itemId,
      ownerWrappedDek: "r".repeat(WRAP.length),
      recipientKeys: [{ contactId, wrappedDek: "r".repeat(WRAP.length) }],
      _audit: await signedAudit(),
    });
    await as.mutation(api.vault_items.updateItem, {
      itemId,
      recipientMode: "explicit",
      sharedWithContacts: [],
      recipientKeys: [],
      _audit: await signedAudit(),
    });
    await as.mutation(api.vault_items.archiveItem, {
      itemId,
      _audit: await signedAudit(),
    });
    await as.mutation(api.vault_items.unarchiveItem, {
      itemId,
      _audit: await signedAudit(),
    });
    await expect(
      editContent(t, owner.userId, itemId, "longer text"),
    ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");
  });
});

describe("storage usage counter", () => {
  it("stays exact across create, edit, attach, detach, archive, restore and re-wrap", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const as = asUser(t, owner.userId);
    const [c1, c2] = [
      await seedTrustContact(t, owner.userId, { n: 1 }),
      await seedTrustContact(t, owner.userId, { n: 2 }),
    ];
    const itemId = await createItem(t, owner, {
      files: 2,
      recipientKeys: [{ contactId: c1, wrappedDek: WRAP }],
    });
    const other = await createItem(t, owner, { files: 1 });
    await expectCounterMatches(t, owner.userId);

    const files = await t.run((ctx) =>
      ctx.db
        .query("vault_item_files")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    await as.mutation(api.vault_items.updateItem, {
      itemId,
      encryptedContent: sealed("x".repeat(3 * KB)),
      removeFileIds: [files[0]._id],
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    await as.mutation(api.vault_items.removeItemFile, {
      itemId,
      fileId: files[1]._id,
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    await as.mutation(api.vault_items.addItemFiles, {
      itemId,
      files: [
        {
          storageId: await seedStorageRef(t, 70_000),
          iv: "aXY=",
          encryptedMeta: sealed("photo"),
        },
      ],
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    const [first] = await t.run((ctx) =>
      ctx.db
        .query("vault_item_versions")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    await as.mutation(api.vault_items.restoreItemVersion, {
      itemId,
      versionId: first._id,
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    // Rotation re-wrap and a wider share.
    await as.mutation(api.vault_items.updateItem, {
      itemId,
      ownerWrappedDek: "r".repeat(1_700),
      recipientKeys: [
        { contactId: c1, wrappedDek: "r".repeat(1_700) },
        { contactId: c2, wrappedDek: "r".repeat(1_700) },
      ],
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    await as.mutation(api.vault_items.archiveItems, {
      itemIds: [itemId, other],
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);
    const archived = await as.query(api.vaults.getUsageStats, {});
    expect(archived.archiveBytes).toBeGreaterThan(0);

    await as.mutation(api.vault_items.addItemFiles, {
      itemId,
      files: [
        {
          storageId: await seedStorageRef(t, 10),
          iv: "aXY=",
          encryptedMeta: sealed("late"),
        },
      ],
      _audit: await signedAudit(),
    });
    await as.mutation(api.vault_items.unarchiveItem, {
      itemId,
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);

    await as.mutation(api.vault_items.backfillItemTitle, {
      itemId,
      encryptedTitle: sealed("A much longer title than before"),
      _audit: await signedAudit(),
    });
    await expectCounterMatches(t, owner.userId);
  });

  it("drops the keys of a contact who deletes their account from the owner's usage", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactUser = await seedUser(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    await t.run((ctx) =>
      ctx.db.patch(contactId, { contactUserId: contactUser }),
    );
    await createItem(t, owner, {
      recipientKeys: [{ contactId, wrappedDek: WRAP }],
    });

    await t.mutation(internal.account_deletion.wipeStep, {
      userId: contactUser,
    });
    await expectCounterMatches(t, owner.userId);
  });

  it("is deleted with the owner's account", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await createItem(t, owner);
    expect(await counter(t, owner.userId)).not.toBeNull();

    await t.mutation(internal.account_deletion.wipeStep, {
      userId: owner.userId,
    });
    expect(await counter(t, owner.userId)).toBeNull();
  });
});

describe("existing accounts (no counter yet)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A pre-counter account: rows written straight to the tables. */
  async function seedLegacy(
    t: TestConvex,
    opts: { versions?: number; versionText?: string } = {},
  ) {
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner.userId, { n: 1 });
    const [kept, dropped] = [
      await seedStorageRef(t, 100),
      await seedStorageRef(t, 200),
    ];
    const itemId = await t.run(async (ctx) => {
      const itemId = await ctx.db.insert("vault_items", {
        vaultId: owner.vaultId,
        userId: owner.userId,
        title: "Legacy plaintext title",
        category: "personal_document",
        encryptedContent: sealed("old note"),
        encryptionType: "zero_knowledge",
        ownerWrappedDek: WRAP,
        sharedWithContacts: [contactId],
        accessLevel: "trusted_only",
        status: "active",
        createdAt: 0,
        updatedAt: 0,
      });
      await ctx.db.insert("vault_item_files", {
        itemId,
        userId: owner.userId,
        storageId: kept,
        iv: "aXY=",
        name: "a.pdf",
        size: 3 * MB,
        order: 0,
        createdAt: 0,
      });
      await ctx.db.insert("vault_item_recipient_keys", {
        itemId,
        contactId,
        wrappedDek: WRAP,
        createdAt: 0,
      });
      await ctx.db.insert("vault_items", {
        vaultId: owner.vaultId,
        userId: owner.userId,
        encryptedContent: sealed("archived"),
        encryptionType: "zero_knowledge",
        sharedWithContacts: [],
        accessLevel: "private",
        status: "archived",
        createdAt: 0,
        updatedAt: 0,
      });
      return itemId;
    });
    // One transaction per version: a large history exceeds one write.
    for (let i = 0; i < (opts.versions ?? 2); i++) {
      await t.run((ctx) =>
        ctx.db.insert("vault_item_versions", {
          itemId,
          userId: owner.userId,
          encryptedContent: opts.versionText ?? sealed(`v${i}`),
          files: [
            { storageId: kept, iv: "aXY=", sizeBucket: 3 * MB, order: 0 },
            { storageId: dropped, iv: "aXY=", sizeBucket: 2 * MB, order: 1 },
          ],
          savedAt: 0,
          replacedAt: 0,
        }),
      );
    }
    return { ...owner, itemId };
  }

  it("the migration builds the counter of every existing account", async () => {
    const t = makeT();
    const a = await seedLegacy(t);
    const b = await seedLegacy(t, { versions: 0 });

    await t.mutation(internal.migrations.backfillStorageUsage, {});
    await runDueJobs(t);

    await expectCounterMatches(t, a.userId);
    await expectCounterMatches(t, b.userId);
    const usage = await asUser(t, a.userId).query(api.vaults.getUsageStats, {});
    // The 2 MB file left only in the history counts once, as history.
    expect(usage.archiveBytes).toBeGreaterThan(2 * MB);
  });

  it("builds a large history over several steps, within the read limits", async () => {
    const t = makeT({ enforceLimits: true });
    const a = await seedLegacy(t, {
      versions: 24,
      versionText: "v".repeat(900 * KB),
    });

    await t.mutation(internal.migrations.backfillStorageUsage, {});
    await runDueJobs(t);

    await expectCounterMatches(t, a.userId);
    // ~21 MB of history: the quota reads none of it.
    const as = asUser(t, a.userId);
    expect((await as.query(api.vaults.canStore, { bytes: 1 })).fits).toBe(true);
    await editContent(t, a.userId, a.itemId, "edited");
    await expectCounterMatches(t, a.userId);
  });

  it("restarts a build an edit lands in the middle of, and still converges", async () => {
    const t = makeT();
    const a = await seedLegacy(t, { versions: 12 });
    await t.mutation(internal.migrations.backfillStorageUsage, {});
    expect((await counter(t, a.userId))?.backfill).toBeDefined();

    await asUser(t, a.userId).mutation(api.vault_items.archiveItem, {
      itemId: a.itemId,
      _audit: await signedAudit(),
    });
    await runDueJobs(t);

    await expectCounterMatches(t, a.userId);
  });

  it("counts attachments only until the counter exists, then builds it on the first write", async () => {
    const t = makeT();
    const a = await seedLegacy(t);
    const before = await asUser(t, a.userId).query(api.vaults.canStore, {
      bytes: 1,
    });
    expect(before.usedBytes).toBe(3 * MB);

    await createItem(t, a);

    await expectCounterMatches(t, a.userId);
  });
});
