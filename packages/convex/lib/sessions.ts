import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * End every Convex Auth session of `userId` except `keep`: deletes the
 * session, its refresh tokens and its step-up markers, so no client can
 * refresh into it again.
 */
export async function endSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
  keep: Id<"authSessions"> | null = null,
) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    if (session._id === keep) continue;
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    for (const table of [
      "auth_session_totp",
      "auth_session_login_otp",
    ] as const) {
      const markers = await ctx.db
        .query(table)
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const marker of markers) await ctx.db.delete(marker._id);
    }
    await ctx.db.delete(session._id);
  }
}
