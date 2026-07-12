import { query } from "../_generated/server";
import { requireAdmin } from "../helpers";

/**
 * Admin identity probe used by the keeplas-admin auth guard (`useAdminGuard`).
 * Throws "FORBIDDEN" for non-admins (the client treats any error as "denied");
 * returns the admin's display name + email on success.
 */
export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    return { name: user?.name ?? "", email: user?.email ?? "" };
  },
});
