import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Create an immutable audit log entry.
 * Each entry includes a hash chain for tamper detection.
 */
export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    actorType: "user" | "trusted_contact" | "system" | "ai_assistant";
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: string;
  }
) {
  // Get the most recent log entry for hash chaining
  const lastLog = await ctx.db
    .query("audit_logs")
    .withIndex("by_user", (q) => q.eq("userId", params.userId))
    .order("desc")
    .first();

  const previousLogHash = lastLog?.logHash ?? "genesis";

  // Compute a simple hash for the chain
  const logData = JSON.stringify({
    previousLogHash,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    timestamp: Date.now(),
  });

  // Use a simple hash (in production, use SHA-256 server-side)
  let hash = 0;
  for (let i = 0; i < logData.length; i++) {
    const char = logData.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const logHash = Math.abs(hash).toString(16).padStart(8, "0");

  await ctx.db.insert("audit_logs", {
    userId: params.userId,
    actorType: params.actorType,
    actorId: params.actorId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    previousLogHash,
    logHash,
    createdAt: Date.now(),
  });
}

/**
 * Fetch the most recent audit log entries for the authenticated user.
 */
export const listLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const limit = args.limit ?? 50;
    return await ctx.db
      .query("audit_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Aggregate counts to drive a "Security Center" dashboard.
 */
export const getSecuritySummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const recentLogs = await ctx.db
      .query("audit_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);

    const accessRequests = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", userId))
      .collect();

    const lastLogin = recentLogs.find((l) => l.action.includes("login"));
    const lastVaultAction = recentLogs.find((l) => l.resourceType === "vault_item");

    return {
      totalEvents: recentLogs.length,
      lastEventAt: recentLogs[0]?.createdAt ?? null,
      lastLoginAt: lastLogin?.createdAt ?? null,
      lastVaultActionAt: lastVaultAction?.createdAt ?? null,
      pendingAccessRequests: accessRequests.filter((r) => r.status === "pending").length,
      approvedAccessRequests: accessRequests.filter((r) => r.status === "approved").length,
      deniedAccessRequests: accessRequests.filter((r) => r.status === "denied").length,
    };
  },
});
