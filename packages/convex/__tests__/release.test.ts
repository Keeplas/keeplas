import { describe, it, expect } from "vitest";
import { internal } from "../_generated/api";
import { makeT, seedUser, type TestConvex } from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Findings 23 / 33: a time-based item (a dated letter, legacy v1 rows) is
// released on its date to its own recipients. It must not release the rest
// of the vault, and must not keep the real Life Check release from later
// handing over everything else.

async function seedVault(t: TestConvex) {
  const owner = await seedUser(t);
  const now = Date.now();
  const vaultId = await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId: owner,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const contactUser = await seedUser(t);
  const contactId = await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: owner,
      contactUserId: contactUser,
      name: "Contact",
      email: "c@example.com",
      role: "family",
      invitationStatus: "accepted",
      invitationToken: "tok-release",
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return { owner, vaultId, contactId };
}

async function seedItem(
  t: TestConvex,
  owner: Id<"users">,
  vaultId: Id<"vaults">,
  opts: { releaseDate?: number; accessLevel?: "private" | "trusted_only" } = {},
): Promise<Id<"vault_items">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vault_items", {
      vaultId,
      userId: owner,
      category: "personal_document",
      title: "Item",
      encryptedContent: "ct",
      encryptionType: "zero_knowledge",
      accessLevel: opts.accessLevel ?? "trusted_only",
      sharedWithContacts: [],
      recipientMode: "default",
      status: "active",
      ...(opts.releaseDate !== undefined
        ? {
            triggerType: "time_based" as const,
            triggerConfig: { releaseDate: opts.releaseDate },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    }),
  );
}

async function releasedTo(
  t: TestConvex,
  contactId: Id<"trusted_contacts">,
): Promise<string[][]> {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("access_requests")
      .withIndex("by_requester", (q) => q.eq("requestedBy", contactId))
      .collect(),
  );
  return rows
    .filter((r) => r.status === "approved")
    .map((r) => [...r.sectionsRequested].sort());
}

describe("time-based release", () => {
  it("releases only the due item, not the rest of the vault", async () => {
    const t = makeT();
    const { owner, vaultId, contactId } = await seedVault(t);
    const letter = await seedItem(t, owner, vaultId, {
      releaseDate: Date.now() - 1000,
    });
    await seedItem(t, owner, vaultId);

    await t.mutation(internal.release.processScheduledReleases, {});

    expect(await releasedTo(t, contactId)).toEqual([[`item:${letter}`]]);
    const row = await t.run((ctx) => ctx.db.get(letter));
    expect(row?.status).toBe("released");
  });

  it("releases nothing for a private due item", async () => {
    const t = makeT();
    const { owner, vaultId, contactId } = await seedVault(t);
    await seedItem(t, owner, vaultId, {
      releaseDate: Date.now() - 1000,
      accessLevel: "private",
    });
    await seedItem(t, owner, vaultId);

    await t.mutation(internal.release.processScheduledReleases, {});

    expect(await releasedTo(t, contactId)).toEqual([]);
  });

  it("the later Life Check release still hands over every other item", async () => {
    const t = makeT();
    const { owner, vaultId, contactId } = await seedVault(t);
    const letter = await seedItem(t, owner, vaultId, {
      releaseDate: Date.now() - 1000,
    });
    const will = await seedItem(t, owner, vaultId);
    await t.mutation(internal.release.processScheduledReleases, {});

    await t.mutation(internal.release.triggerRelease, {
      userId: owner,
      reason: "life_check_confirmed",
    });
    // Idempotent: a second run adds nothing.
    await t.mutation(internal.release.triggerRelease, {
      userId: owner,
      reason: "life_check_confirmed",
    });

    // One release row per contact (memorial serves the first one it finds).
    expect(await releasedTo(t, contactId)).toEqual([
      [`item:${letter}`, `item:${will}`].sort(),
    ]);
  });
});
