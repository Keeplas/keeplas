import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  type TestConvex,
} from "./test.helpers";

// A released contact reads the files of the items left to them. Once the
// owner archives an item or makes it private, its files must stop being
// served, exactly like the item itself (memorial.shapeItem).

const SEALED = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });

async function seedRelease(t: TestConvex) {
  const owner = await seedUser(t);
  const contactUser = await seedUser(t);
  const storageId = await seedStorageRef(t, 64);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      userId: owner,
      encryptedItemsCount: 1,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const itemId = await ctx.db.insert("vault_items", {
      vaultId,
      userId: owner,
      encryptedMeta: SEALED,
      encryptedContent: SEALED,
      encryptionType: "zero_knowledge",
      sharedWithContacts: [],
      accessLevel: "trusted_only",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const fileId = await ctx.db.insert("vault_item_files", {
      itemId,
      userId: owner,
      storageId,
      iv: "aXY=",
      encryptedMeta: SEALED,
      sizeBucket: 4096,
      order: 0,
      createdAt: now,
    });
    const contactId = await ctx.db.insert("trusted_contacts", {
      userId: owner,
      contactUserId: contactUser,
      name: "Alex",
      email: "alex@example.com",
      role: "family",
      invitationStatus: "accepted",
      invitationToken: "tok-alex",
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("access_requests", {
      vaultUserId: owner,
      requestedBy: contactId,
      sectionsRequested: [`item:${itemId}`],
      status: "approved",
      autoResponseAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { itemId, fileId, contactId };
  });
  return { ...ids, contact: asUser(t, contactUser) };
}

async function readFiles(
  release: Awaited<ReturnType<typeof seedRelease>>,
): Promise<{ files: unknown[]; url: string | null }> {
  const { contact, contactId, itemId, fileId } = release;
  return {
    files: await contact.query(api.memorial.getMemorialItemFiles, {
      contactId,
      itemId,
    }),
    url: await contact.query(api.memorial.getMemorialItemFileUrl, {
      contactId,
      fileId,
    }),
  };
}

describe("memorial files", () => {
  it("serves the files of an item released to the contact", async () => {
    const t = makeT();
    const release = await seedRelease(t);

    const { files, url } = await readFiles(release);
    expect(files).toHaveLength(1);
    expect(url).not.toBeNull();
  });

  it.each([
    ["archived", { status: "archived" as const }],
    ["made private", { accessLevel: "private" as const }],
  ])("stops serving them once the owner has %s the item", async (_, patch) => {
    const t = makeT();
    const release = await seedRelease(t);
    await t.run((ctx) => ctx.db.patch(release.itemId, patch));

    const { files, url } = await readFiles(release);
    expect(files).toEqual([]);
    expect(url).toBeNull();
  });
});
