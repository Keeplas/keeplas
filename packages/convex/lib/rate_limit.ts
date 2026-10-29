import { ConvexError } from "convex/values";
import { MutationCtx } from "../_generated/server";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Record a hit for `key` unless `max` hits already happened within the
 * trailing window; resolves whether it was recorded (false = over the limit).
 * Expired rows for the key are pruned opportunistically so the table
 * self-cleans without a cron.
 */
export async function takeRateLimitSlot(
  ctx: MutationCtx,
  key: string,
  max: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = await ctx.db
    .query("ip_rate_limits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();

  let recent = 0;
  for (const hit of hits) {
    if (hit.createdAt >= cutoff) {
      recent++;
    } else {
      await ctx.db.delete(hit._id);
    }
  }

  if (recent >= max) return false;
  await ctx.db.insert("ip_rate_limits", { key, createdAt: now });
  return true;
}

/**
 * Throttle an unauthenticated, IP-attributable endpoint: counts prior hits for
 * `${scope}:${ip}` within the trailing window and throws once `max` is
 * exceeded.
 *
 * `ip` comes from the server-attested `_audit` envelope — never a
 * client-supplied value — so it can't be spoofed to dodge the limit.
 */
export async function enforceIpRateLimit(
  ctx: MutationCtx,
  scope: string,
  ip: string,
  max: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<void> {
  if (!(await takeRateLimitSlot(ctx, `${scope}:${ip}`, max, windowMs))) {
    throw new ConvexError("Too many requests. Try again later.");
  }
}
