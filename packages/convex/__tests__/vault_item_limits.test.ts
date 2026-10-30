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

// Recipient-key rows sit outside the storage quota. One call must not be able
// to write thousands of them (the same contact repeated) or megabyte-sized
// "wraps": one row per contact, of an ML-KEM envelope's size (gap28).

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });
// A real ML-KEM-768 + AES-GCM envelope is ~1.6 KB.
const WRAP = "w".repeat(1_600);
const OVERSIZED_WRAP = "w".repeat(100_000);

type RecipientKey = { contactId: Id<"trusted_contacts">; wrappedDek: string };

async function seedOwner(t: TestConvex) {
  const userId = await seedUser(t);
  const now = Date.now();
  const vaultId = await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const contactId = await seedTrustContact(t, userId, { n: 1 });
  return { userId, vaultId, contactId };
}

async function keyRows(t: TestConvex, itemId: Id<"vault_items">) {
  return await t.run((ctx) =>
    ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect(),
  );
}

async function create(
  t: TestConvex,
  owner: { userId: Id<"users">; vaultId: Id<"vaults"> },
  recipientKeys: RecipientKey[],
) {
  return asUser(t, owner.userId).mutation(api.vault_items.createItem, {
    vaultId: owner.vaultId,
    encryptedMeta: SEALED,
    encryptedTitle: SEALED,
    encryptedContent: SEALED,
    accessLevel: "trusted_only",
    encryptionType: "zero_knowledge",
    ownerWrappedDek: WRAP,
    recipientKeys,
    _audit: await signedAudit(),
  });
}

describe("recipient keys are capped", () => {
  it("createItem stores one row per contact, however often it is listed", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const itemId = await create(
      t,
      owner,
      Array.from({ length: 50 }, () => ({
        contactId: owner.contactId,
        wrappedDek: WRAP,
      })),
    );
    expect(await keyRows(t, itemId)).toHaveLength(1);
  });

  it("createItem refuses an oversized wrap", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await expect(
      create(t, owner, [
        { contactId: owner.contactId, wrappedDek: OVERSIZED_WRAP },
      ]),
    ).rejects.toThrow(/too large/);
  });

  it("updateItem stores one row per contact (rotation re-sends legacy rows)", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const itemId = await create(t, owner, []);
    await asUser(t, owner.userId).mutation(api.vault_items.updateItem, {
      itemId,
      recipientKeys: [
        { contactId: owner.contactId, wrappedDek: WRAP },
        { contactId: owner.contactId, wrappedDek: WRAP },
      ],
      _audit: await signedAudit(),
    });
    expect(await keyRows(t, itemId)).toHaveLength(1);
  });

  it("addRecipientKeys refuses an oversized wrap", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const itemId = await create(t, owner, []);
    await expect(
      asUser(t, owner.userId).mutation(api.vault_items.addRecipientKeys, {
        itemId,
        recipientKeys: [
          { contactId: owner.contactId, wrappedDek: OVERSIZED_WRAP },
        ],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(/too large/);
  });
});
