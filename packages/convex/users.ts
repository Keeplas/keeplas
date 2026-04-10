import { query } from "./_generated/server";
import { optionalAuth } from "./helpers";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    return await ctx.db.get(userId);
  },
});
