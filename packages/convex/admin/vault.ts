import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy } from "./lib";
import { storedFileBytes } from "../lib/storage";

/**
 * Vault items grouped by category. Categories are end-to-end encrypted (F4):
 * only legacy rows not yet backfilled show one; the rest count as
 * "encrypted".
 */
export const itemsByCategory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("vault_items").collect();
    return countBy(items, (i) => i.category ?? "encrypted");
  },
});

/** Vault items grouped by encryption type. */
export const itemsByEncryption = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("vault_items").collect();
    return countBy(items, (i) => i.encryptionType);
  },
});

/** Vault items grouped by access level. */
export const itemsByAccessLevel = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("vault_items").collect();
    return countBy(items, (i) => i.accessLevel);
  },
});

/**
 * Encrypted-file storage totals. `byKind` is a FILE COUNT per kind (consistent
 * with the other "by*" breakdowns; kinds are encrypted since F4, so most files
 * count as "encrypted"); `totalBytes` sums the size buckets.
 */
export const storageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const files = await ctx.db.query("vault_item_files").collect();
    return {
      fileCount: files.length,
      totalBytes: files.reduce((sum, f) => sum + storedFileBytes(f), 0),
      byKind: countBy(files, (f) => f.kind ?? "encrypted"),
    };
  },
});
