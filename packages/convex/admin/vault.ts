import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";
import { countBy } from "./lib";

/** Vault items grouped by category. */
export const itemsByCategory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const items = await ctx.db.query("vault_items").collect();
    return countBy(items, (i) => i.category);
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
 * with the other "by*" breakdowns); `totalBytes` is the summed encrypted size.
 */
export const storageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const files = await ctx.db.query("vault_item_files").collect();
    return {
      fileCount: files.length,
      totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      byKind: countBy(files, (f) => f.kind),
    };
  },
});
