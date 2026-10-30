import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

// User-written rows must not be able to break the admin console: audit
// metadata stays small, and the audit breakdown reads a bounded page (gap31).

describe("admin console bounds", () => {
  it("auditByAction survives an audit log larger than one query may read", async () => {
    const t = makeT({ enforceLimits: true });
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", { role: "admin" }),
    );
    const userId = await seedUser(t);
    const metadata = "m".repeat(100_000);
    // ~20 MiB of audit rows, written in small transactions.
    for (let batch = 0; batch < 20; batch++) {
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("audit_logs", {
            userId,
            actorType: "user",
            actorId: userId,
            action: "vault_items.archived",
            resourceType: "vault_item",
            resourceId: userId,
            metadata,
            previousLogHash: "h",
            logHash: "h",
            createdAt: Date.now(),
          });
        }
      });
    }

    const counts = await asUser(t, adminId).query(
      api.admin.security.auditByAction,
      {},
    );

    expect(counts["vault_items.archived"]).toBeGreaterThan(0);
  });

  it("archiveItems records how many items it archived, not their ids", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const now = Date.now();
    const vaultId = await t.run((ctx) =>
      ctx.db.insert("vaults", {
        userId,
        encryptedItemsCount: 2,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const itemIds: Id<"vault_items">[] = [];
    for (let i = 0; i < 2; i++) {
      itemIds.push(
        await t.run((ctx) =>
          ctx.db.insert("vault_items", {
            vaultId,
            userId,
            encryptedContent: "ct",
            encryptionType: "zero_knowledge",
            accessLevel: "private",
            sharedWithContacts: [],
            status: "active",
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );
    }

    await asUser(t, userId).mutation(api.vault_items.archiveItems, {
      itemIds,
      _audit: await signedAudit(),
    });

    const entry = await t.run((ctx) =>
      ctx.db
        .query("audit_logs")
        .withIndex("by_action", (q) =>
          q.eq("userId", userId).eq("action", "vault_items.archived"),
        )
        .unique(),
    );
    expect(JSON.parse(entry!.metadata!)).toEqual({ count: 2 });
  });
});
