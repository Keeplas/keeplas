import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Deferred shares: an item saved with a contact that hadn't published their
// key yet records that contact in `pendingRecipients` (no wrapped DEK exists).
// `getItemsNeedingRewrap` surfaces such items once the contact publishes;
// `addRecipientKeys` inserts the late wrap and clears the contact from pending.

const ENC = JSON.stringify({ ciphertext: "dGl0bGU=", iv: "aXY=" });
const OWNER_WRAP = JSON.stringify({
  v: 1,
  alg: "x",
  kem: "k",
  iv: "i",
  ct: "c",
});
const WRAPPED_DEK = JSON.stringify({
  v: 1,
  alg: "x",
  kem: "k",
  iv: "i",
  ct: "d",
});

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

/** A trusted contact. `published` controls whether its key material is set. */
async function seedContact(
  t: TestConvex,
  userId: Id<"users">,
  published: boolean,
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId,
      name: "Joas KATIMBA",
      role: "family",
      invitationStatus: "accepted",
      invitationToken: `tok-${published ? "pub" : "nopub"}-${now}`,
      invitedAt: now,
      contactPublicKey: published ? "kem-pub" : undefined,
      contactIdentityPublicKey: published ? "dsa-pub" : undefined,
      contactPublicKeySignature: published ? "sig" : undefined,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

async function seedPendingItem(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
  pending: Id<"trusted_contacts">[],
): Promise<Id<"vault_items">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vault_items", {
      vaultId,
      userId,
      category: "personal_document",
      encryptedTitle: ENC,
      encryptedContent: ENC,
      encryptionType: "zero_knowledge",
      sharedWithContacts: [],
      pendingRecipients: pending,
      ownerWrappedDek: OWNER_WRAP,
      accessLevel: "trusted_only",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("deferred shares re-wrap", () => {
  it("getItemsNeedingRewrap returns items whose pending contact has published", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const contactId = await seedContact(t, userId, true);
    const itemId = await seedPendingItem(t, userId, vaultId, [contactId]);

    const rows = await asUser(t, userId).query(
      api.vault_items.getItemsNeedingRewrap,
      {},
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(itemId);
    expect(rows[0].ownerWrappedDek).toBe(OWNER_WRAP);
    expect(rows[0].readyContacts).toHaveLength(1);
    expect(rows[0].readyContacts[0]._id).toBe(contactId);
  });

  it("getItemsNeedingRewrap skips pending contacts that haven't published", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const contactId = await seedContact(t, userId, false);
    await seedPendingItem(t, userId, vaultId, [contactId]);

    const rows = await asUser(t, userId).query(
      api.vault_items.getItemsNeedingRewrap,
      {},
    );

    expect(rows).toHaveLength(0);
  });

  it("addRecipientKeys inserts the wrap and clears the contact from pending", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const contactId = await seedContact(t, userId, true);
    const itemId = await seedPendingItem(t, userId, vaultId, [contactId]);

    await asUser(t, userId).mutation(api.vault_items.addRecipientKeys, {
      itemId,
      recipientKeys: [{ contactId, wrappedDek: WRAPPED_DEK }],
      _audit: await signedAudit(),
    });

    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item?.pendingRecipients).toEqual([]);

    const keys = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(keys).toHaveLength(1);
    expect(keys[0].contactId).toBe(contactId);
    expect(keys[0].wrappedDek).toBe(WRAPPED_DEK);
  });

  it("addRecipientKeys is idempotent — a second call adds no duplicate row", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const contactId = await seedContact(t, userId, true);
    const itemId = await seedPendingItem(t, userId, vaultId, [contactId]);

    const call = async () =>
      asUser(t, userId).mutation(api.vault_items.addRecipientKeys, {
        itemId,
        recipientKeys: [{ contactId, wrappedDek: WRAPPED_DEK }],
        _audit: await signedAudit(),
      });
    await call();
    await call();

    const keys = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(keys).toHaveLength(1);
  });

  it("addRecipientKeys ignores a contact that isn't pending on the item", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const pendingContact = await seedContact(t, userId, true);
    const otherContact = await seedContact(t, userId, true);
    const itemId = await seedPendingItem(t, userId, vaultId, [pendingContact]);

    await asUser(t, userId).mutation(api.vault_items.addRecipientKeys, {
      itemId,
      recipientKeys: [{ contactId: otherContact, wrappedDek: WRAPPED_DEK }],
      _audit: await signedAudit(),
    });

    const keys = await t.run((ctx) =>
      ctx.db
        .query("vault_item_recipient_keys")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect(),
    );
    expect(keys).toHaveLength(0);
    const item = await t.run((ctx) => ctx.db.get(itemId));
    expect(item?.pendingRecipients).toEqual([pendingContact]);
  });

  it("addRecipientKeys rejects a non-owner", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const stranger = await seedUser(t);
    const vaultId = await seedVault(t, owner);
    const contactId = await seedContact(t, owner, true);
    const itemId = await seedPendingItem(t, owner, vaultId, [contactId]);

    await expect(
      asUser(t, stranger).mutation(api.vault_items.addRecipientKeys, {
        itemId,
        recipientKeys: [{ contactId, wrappedDek: WRAPPED_DEK }],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Item not found");
  });
});
