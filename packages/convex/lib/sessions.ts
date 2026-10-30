import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Delete one Convex Auth session with its refresh tokens, step-up markers
 * and device PIN secrets, so no client can refresh into it again
 * (`requireAuth` also rejects its live JWT) and its browser's PIN wraps open
 * nothing.
 */
export async function endSession(
  ctx: MutationCtx,
  sessionId: Id<"authSessions">,
) {
  const tokens = await ctx.db
    .query("authRefreshTokens")
    .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const token of tokens) await ctx.db.delete(token._id);
  for (const table of [
    "auth_session_totp",
    "auth_session_login_otp",
    "auth_session_proofs",
    "session_vault_challenges",
    "device_pins",
  ] as const) {
    const markers = await ctx.db
      .query(table)
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const marker of markers) await ctx.db.delete(marker._id);
  }
  if (await ctx.db.get(sessionId)) await ctx.db.delete(sessionId);
}

/**
 * End every session of `userId` except `keep`. Returns how many were ended.
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
  const ended = sessions.filter((s) => s._id !== keep);
  for (const session of ended) await endSession(ctx, session._id);
  return ended.length;
}
