import { MutationCtx } from "./_generated/server";
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
