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

// Titles are the only free-text vault-item metadata; they must never be stored
// in plaintext. createItem writes `encryptedTitle`, the plaintext `title` is
// gone, and the client-side `backfillItemTitle` migrates legacy rows.

const ENC = JSON.stringify({ ciphertext: "dGl0bGU=", iv: "aXY=" });
const ENC_CONTENT = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

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

/** Insert a legacy row that still carries a plaintext title (pre-migration). */
async function seedLegacyItem(
  t: TestConvex,
  userId: Id<"users">,
  vaultId: Id<"vaults">,
): Promise<Id<"vault_items">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vault_items", {
      vaultId,
      userId,
      category: "personal_document",
      title: "Legacy plaintext",
      encryptedContent: "c",
      encryptionType: "aes_256_gcm",
      sharedWithContacts: [],
      accessLevel: "private",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("vault item titles are encrypted at rest", () => {
  it("createItem stores encryptedTitle and no plaintext title", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);

    const itemId = (await asUser(t, userId).mutation(
      api.vault_items.createItem,
      {
        vaultId,
        category: "personal_document",
        encryptedTitle: ENC,
        encryptedContent: ENC_CONTENT,
        accessLevel: "private",
        _audit: await signedAudit(),
      },
    )) as Id<"vault_items">;

    const row = await t.run((ctx) => ctx.db.get(itemId));
    expect(row?.encryptedTitle).toBe(ENC);
    expect(row?.title).toBeUndefined();
  });

  it("updateItem re-encrypts the title", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const itemId = (await asUser(t, userId).mutation(
      api.vault_items.createItem,
      {
        vaultId,
        category: "personal_document",
        encryptedTitle: ENC,
        encryptedContent: ENC_CONTENT,
        accessLevel: "private",
        _audit: await signedAudit(),
      },
    )) as Id<"vault_items">;

    const next = JSON.stringify({ ciphertext: "bmV3dGl0bGU=", iv: "aXYy" });
    await asUser(t, userId).mutation(api.vault_items.updateItem, {
      itemId,
      encryptedTitle: next,
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(itemId));
    expect(row?.encryptedTitle).toBe(next);
  });

  it("backfillItemTitle encrypts a legacy title and clears the plaintext, idempotently", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const vaultId = await seedVault(t, userId);
    const itemId = await seedLegacyItem(t, userId, vaultId);

    await asUser(t, userId).mutation(api.vault_items.backfillItemTitle, {
      itemId,
      encryptedTitle: ENC,
      _audit: await signedAudit(),
    });

    const row = await t.run((ctx) => ctx.db.get(itemId));
    expect(row?.encryptedTitle).toBe(ENC);
    expect(row?.title).toBeUndefined();

    // Running again is a no-op (already migrated).
    await asUser(t, userId).mutation(api.vault_items.backfillItemTitle, {
      itemId,
      encryptedTitle: ENC,
      _audit: await signedAudit(),
    });
    const row2 = await t.run((ctx) => ctx.db.get(itemId));
    expect(row2?.encryptedTitle).toBe(ENC);
  });

  it("backfillItemTitle rejects a non-owner", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const stranger = await seedUser(t);
    const vaultId = await seedVault(t, owner);
    const itemId = await seedLegacyItem(t, owner, vaultId);

    await expect(
      asUser(t, stranger).mutation(api.vault_items.backfillItemTitle, {
        itemId,
        encryptedTitle: ENC,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Item not found");
  });
});
