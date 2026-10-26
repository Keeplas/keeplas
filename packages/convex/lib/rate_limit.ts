import { MutationCtx } from "../_generated/server";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Throttle an unauthenticated, IP-attributable endpoint.
 *
 * Counts prior hits for `${scope}:${ip}` within the trailing window and throws
 * once `max` is exceeded; otherwise records this hit. Expired rows for the key
 * are pruned opportunistically so the table self-cleans without a cron.
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
  const key = `${scope}:${ip}`;
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

  if (recent >= max) {
    throw new Error("Too many requests. Try again later.");
  }

  await ctx.db.insert("ip_rate_limits", { key, createdAt: now });
}
