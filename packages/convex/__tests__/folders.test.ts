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

// v2 sharing per folder (M06-4, M06-6, M03-1, M03-2): "this folder only",
// now or after verification (release).

const SEALED = JSON.stringify({ ciphertext: "c2VhbGVk", iv: "aXY=" });

async function setup() {
  const t = makeT();
  const ownerId = await seedUser(t);
  const owner = asUser(t, ownerId);
  const contactId = await seedTrustContact(t, ownerId, { n: 1 });
  const recipientId = await seedUser(t);
  await t.run((ctx) => ctx.db.patch(contactId, { contactUserId: recipientId }));
  const recipient = asUser(t, recipientId);

  const folderId = await owner.mutation(api.folders.create, {
    encryptedName: SEALED,
    _audit: await signedAudit(),
  });
  const itemIds = await t.run(async (ctx) => {
    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      userId: ownerId,
      encryptedItemsCount: 3,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const make = (folder?: Id<"folders">) =>
      ctx.db.insert("vault_items", {
        vaultId,
        userId: ownerId,
        folderId: folder,
        encryptedMeta: SEALED,
        encryptedContent: SEALED,
        encryptionType: "zero_knowledge",
        ownerWrappedDek: "owner-dek",
        sharedWithContacts: [],
        accessLevel: "private",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    return {
      inFolder: await make(folderId),
      other: await make(),
    };
  });
  return { t, ownerId, owner, contactId, recipient, folderId, itemIds };
}

async function grant(
  s: Awaited<ReturnType<typeof setup>>,
  timing: "now" | "after_verification",
) {
  return s.owner.mutation(api.folders.grant, {
    folderId: s.folderId,
    contactId: s.contactId,
    timing,
    sealedName: "sealed-for-contact",
    itemKeys: [
      { itemId: s.itemIds.inFolder, wrappedDek: "dek-for-contact" },
      // Not in the folder: must be ignored.
      { itemId: s.itemIds.other, wrappedDek: "smuggled" },
    ],
    _audit: await signedAudit(),
  });
}

function keysFor(t: TestConvex, contactId: Id<"trusted_contacts">) {
  return t.run((ctx) =>
    ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect(),
  );
}

describe("folder sharing", () => {
  it("shares this folder only, readable now", async () => {
    const s = await setup();
    const grantId = await grant(s, "now");

    const keys = await keysFor(s.t, s.contactId);
    expect(keys.map((k) => k.itemId)).toEqual([s.itemIds.inFolder]);

    const [shared] = await s.recipient.query(api.folders.sharedWithMe, {});
    expect(shared).toMatchObject({
      grantId,
      sealedName: "sealed-for-contact",
      available: true,
      itemCount: 1,
    });
    const folder = await s.recipient.query(api.folders.getSharedFolder, {
      grantId,
    });
    expect(folder?.items.map((i) => [i._id, i.wrappedDek])).toEqual([
      [s.itemIds.inFolder, "dek-for-contact"],
    ]);
  });

  it("keeps an after-verification folder locked until the release", async () => {
    const s = await setup();
    const grantId = await grant(s, "after_verification");
    expect(await s.recipient.query(api.folders.sharedWithMe, {})).toMatchObject(
      [{ available: false }],
    );
    expect(
      await s.recipient.query(api.folders.getSharedFolder, { grantId }),
    ).toBeNull();

    await s.t.mutation(internal.release.triggerRelease, {
      userId: s.ownerId,
      reason: "test",
    });
    expect(await s.recipient.query(api.folders.sharedWithMe, {})).toMatchObject(
      [{ available: true }],
    );
    const request = await s.t.run((ctx) =>
      ctx.db.query("access_requests").first(),
    );
    expect(request?.sectionsRequested).toEqual([`item:${s.itemIds.inFolder}`]);
  });

  it("revoking ends access and drops the DEK wraps", async () => {
    const s = await setup();
    const grantId = await grant(s, "now");
    await s.owner.mutation(api.folders.revokeGrant, {
      grantId,
      _audit: await signedAudit(),
    });
    expect(await s.recipient.query(api.folders.sharedWithMe, {})).toEqual([]);
    expect(await keysFor(s.t, s.contactId)).toEqual([]);
  });

  it("moving an item out of a shared folder drops its wrap", async () => {
    const s = await setup();
    await grant(s, "now");
    await s.owner.mutation(api.folders.moveItem, {
      itemId: s.itemIds.inFolder,
      folderId: null,
      recipientKeys: [],
      _audit: await signedAudit(),
    });
    expect(await keysFor(s.t, s.contactId)).toEqual([]);
  });

  it("moving an item in wraps it for the folder's grantees only", async () => {
    const s = await setup();
    await grant(s, "now");
    const stranger = await seedTrustContact(s.t, s.ownerId, { n: 2 });
    await s.owner.mutation(api.folders.moveItem, {
      itemId: s.itemIds.other,
      folderId: s.folderId,
      recipientKeys: [
        { contactId: s.contactId, wrappedDek: "dek2" },
        { contactId: stranger, wrappedDek: "nope" },
      ],
      _audit: await signedAudit(),
    });
    expect((await keysFor(s.t, s.contactId)).length).toBe(2);
    expect(await keysFor(s.t, stranger)).toEqual([]);
  });

  it("someone else cannot open the folder", async () => {
    const s = await setup();
    const grantId = await grant(s, "now");
    const intruder = asUser(s.t, await seedUser(s.t));
    expect(
      await intruder.query(api.folders.getSharedFolder, { grantId }),
    ).toBeNull();
    await expect(
      intruder.mutation(api.folders.revokeGrant, {
        grantId,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Access not found");
  });
});
