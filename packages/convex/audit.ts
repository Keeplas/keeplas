import { getAuthUserId } from "@convex-dev/auth/server";
import { v, Validator, ObjectType, PropertyValidators } from "convex/values";
import type { RegisteredMutation } from "convex/server";
import { mutation, MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./helpers";
import { getAuditSecret } from "./lib/audit-secret";

/**
 * Sealed envelope produced by the Next.js middleware. Carries the
 * server-attested IP + country alongside the timestamp at which they were
 * captured and an HMAC over the tuple. The client treats it as opaque.
 */
export const auditContextValidator = v.object({
  ip: v.string(),
  country: v.string(),
  ts: v.number(),
  sig: v.string(),
});

export type AuditContext = ObjectType<typeof auditContextValidator.fields>;

const AUDIT_CONTEXT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Verify the HMAC seal on an audit context. Throws if the signature is
 * invalid, the payload is stale, or the secret is misconfigured.
 */
export async function verifyAuditContext(payload: AuditContext): Promise<void> {
  const age = Date.now() - payload.ts;
  if (age < -60_000 || age > AUDIT_CONTEXT_MAX_AGE_MS) {
    throw new Error("Audit context expired or clock-skewed");
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getAuditSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = base64ToBytes(payload.sig);
  const data = enc.encode(`${payload.ip}|${payload.country}|${payload.ts}`);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    data as BufferSource
  );

  if (!valid) throw new Error("Invalid audit context signature");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Create an immutable audit log entry. Each entry carries a chained hash so
 * the sequence can be replayed and verified end-to-end. `ipAddress` and
 * `country` are populated when the caller went through `auditedMutation`.
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
    ipAddress?: string;
    country?: string;
    deviceInfo?: string;
  }
) {
  const lastLog = await ctx.db
    .query("audit_logs")
    .withIndex("by_user", (q) => q.eq("userId", params.userId))
    .order("desc")
    .first();

  const previousLogHash = lastLog?.logHash ?? "genesis";

  const logData = JSON.stringify({
    previousLogHash,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    timestamp: Date.now(),
  });

  // NOTE: simple JS hash kept for parity with prior records. Followup will
  // upgrade the chain to SHA-256 once a verified replay tool ships.
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
    ipAddress: params.ipAddress,
    country: params.country,
    deviceInfo: params.deviceInfo,
    previousLogHash,
    logHash,
    createdAt: Date.now(),
  });
}

/**
 * Build a state-changing mutation that automatically:
 *   1. Verifies the server-attested audit context (HMAC + freshness).
 *   2. Resolves the authenticated user.
 *   3. Runs the caller's handler.
 *   4. Appends a chained audit log entry with action / resourceType / IP /
 *      country derived from the operation.
 *
 * Every mutation that mutates user-owned state must use this helper so that
 * the audit trail stays exhaustive and tamper-evident — that's the whole
 * legal-admissibility story.
 */
export type ActorIdentity = {
  /**
   * The user whose audit chain receives this entry. Usually the acting
   * user; differs for cross-user actions (e.g. a trusted contact accepting
   * an invitation — the entry lives on the vault owner's chain).
   */
  chainUserId: Id<"users">;
  actorType: "user" | "trusted_contact" | "system" | "ai_assistant";
  actorId: string;
};

export function auditedMutation<
  Args extends PropertyValidators,
  Output,
>(opts: {
  action: string;
  resourceType: string;
  args: Args;
  handler: (ctx: MutationCtx, args: ObjectType<Args>) => Promise<Output>;
  /**
   * Optional resolver for the resource ID to record on the audit entry.
   * Defaults to the acting user's ID, which is the right answer for
   * profile-style mutations. For per-resource mutations (vault items,
   * contacts, …) return the affected entity's ID instead.
   */
  getResourceId?: (
    args: ObjectType<Args>,
    result: Output,
    userId: Id<"users">
  ) => string;
  /**
   * Optional structured metadata persisted as JSON alongside the entry.
   */
  getMetadata?: (
    args: ObjectType<Args>,
    result: Output
  ) => Record<string, unknown> | undefined;
  /**
   * Optional override for the actor identity. Defaults to treating the
   * authenticated user as both the actor and the chain owner. Use this
   * when the action targets a different user's audit chain (e.g. a
   * trusted contact acting on the inviter's vault).
   */
  resolveActor?: (
    ctx: MutationCtx,
    args: ObjectType<Args>
  ) => Promise<ActorIdentity>;
}): RegisteredMutation<
  "public",
  ObjectType<Args> & { _audit: AuditContext },
  Promise<Output>
> {
  const argsWithAudit = {
    ...opts.args,
    _audit: auditContextValidator,
  } as Args & { _audit: typeof auditContextValidator };

  return mutation({
    args: argsWithAudit,
    handler: async (ctx, args) => {
      const { _audit, ...rest } = args as ObjectType<Args> & {
        _audit: AuditContext;
      };
      await verifyAuditContext(_audit);

      const restArgs = rest as unknown as ObjectType<Args>;

      const actor = opts.resolveActor
        ? await opts.resolveActor(ctx, restArgs)
        : await defaultActor(ctx);

      const result = await opts.handler(ctx, restArgs);

      const resourceId =
        opts.getResourceId?.(restArgs, result, actor.chainUserId) ??
        actor.chainUserId;
      const metadataObj = opts.getMetadata?.(restArgs, result);

      await createAuditLog(ctx, {
        userId: actor.chainUserId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId,
        metadata: metadataObj ? JSON.stringify(metadataObj) : undefined,
        ipAddress: _audit.ip,
        country: _audit.country,
      });

      return result;
    },
  });
}

async function defaultActor(ctx: MutationCtx): Promise<ActorIdentity> {
  const userId = await requireAuth(ctx);
  return { chainUserId: userId, actorType: "user", actorId: userId };
}

// Suppress unused import warning — `Validator` is exported intentionally as
// part of this module's surface for downstream callers building generic
// helpers on top of `auditedMutation`.
export type { Validator };

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
