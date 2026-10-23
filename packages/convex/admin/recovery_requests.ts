import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { createAuditLog } from "../audit";
import { requireAdmin } from "../helpers";

/**
 * Lost-number requests (number_change.ts) as the admin console reviews them:
 * what the requester declared next to what the account holds. Only
 * non-encrypted account facts are exposed: the server knows nothing of the
 * vault. Approving never opens it, and never shortens the 72 h window.
 *
 * Approve / reject are bare mutations: `auditedMutation` needs the sealed
 * request context only the Keeplas web app issues, and the console lives on
 * another origin. They write the audit entry themselves, on the owner's
 * chain, with the admin as actor.
 */

type Request = Doc<"number_change_requests">;

function summary(row: Request, user: Doc<"users"> | null) {
  return {
    requestId: row._id,
    status: row.status,
    createdAt: row.createdAt,
    windowEndsAt: row.windowEndsAt,
    oldPhone: row.oldPhone,
    newPhone: row.newPhone,
    declaredName: row.declaredName,
    declaredEmail: row.declaredEmail ?? null,
    accountName: user?.name ?? null,
    accountEmail: user?.email ?? null,
  };
}

/** Open requests (pending review, or approved and waiting), oldest first. */
export const listOpen = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows: Request[] = [];
    for (const status of ["pending", "approved"] as const) {
      rows.push(
        ...(await ctx.db
          .query("number_change_requests")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(100)),
      );
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return Promise.all(
      rows.map(async (row) => summary(row, await ctx.db.get(row.userId))),
    );
  },
});

/** One request with the account facts support compares it against. */
export const get = query({
  args: { requestId: v.id("number_change_requests") },
  handler: async (ctx, { requestId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(requestId);
    if (!row) return null;
    const user = await ctx.db.get(row.userId);
    const [devices, passkeys, contacts, backup, history] = await Promise.all([
      ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .collect(),
      ctx.db
        .query("passkey_credentials")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .collect(),
      ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .collect(),
      ctx.db
        .query("cloud_backup_envelopes")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .first(),
      ctx.db
        .query("number_change_requests")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .collect(),
    ]);
    return {
      ...summary(row, user),
      message: row.message ?? null,
      reviewNote: row.reviewNote ?? null,
      reviewedAt: row.reviewedAt ?? null,
      account: {
        createdAt: user?._creationTime ?? null,
        language: user?.language ?? null,
        country: user?.country ?? null,
        lastSeenAt: user?.lastSeenAt ?? null,
        hasRecoveryKit: !!user?.recoveryPhraseHash,
        hasCloudBackup: backup !== null,
        passkeys: passkeys.length,
        trustContacts: contacts.filter((c) => c.invitationStatus === "accepted")
          .length,
        devices: devices
          .filter((d) => d.revokedAt === undefined)
          .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
          .slice(0, 10)
          .map((d) => ({
            label: d.label,
            kind: d.kind,
            country: d.country ?? null,
            lastSeenAt: d.lastSeenAt,
          })),
      },
      history: history
        .filter((h) => h._id !== row._id)
        .map((h) => ({
          requestId: h._id,
          status: h.status,
          createdAt: h.createdAt,
        })),
    };
  },
});

async function review(
  ctx: QueryCtx,
  requestId: Id<"number_change_requests">,
  allowed: Request["status"][],
) {
  const adminId = await requireAdmin(ctx);
  const row = await ctx.db.get(requestId);
  if (!row) throw new ConvexError("NOT_FOUND");
  if (!allowed.includes(row.status)) throw new ConvexError("NOT_REVIEWABLE");
  return { adminId, row };
}

/**
 * The declared details match the account. The change still waits for the
 * end of the 72 h window, and "It wasn't me" still cancels it.
 */
export const approve = mutation({
  args: {
    requestId: v.id("number_change_requests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, note }) => {
    const { adminId, row } = await review(ctx, requestId, ["pending"]);
    await ctx.db.patch(row._id, {
      status: "approved",
      reviewedBy: adminId,
      reviewedAt: Date.now(),
      reviewNote: note?.trim() || undefined,
    });
    await createAuditLog(ctx, {
      userId: row.userId,
      actorType: "system",
      actorId: `admin:${adminId}`,
      action: "number_change.approved",
      resourceType: "number_change_request",
      resourceId: row._id,
    });
  },
});

/** The details don't match (or it looks like an attack): close it. */
export const reject = mutation({
  args: {
    requestId: v.id("number_change_requests"),
    note: v.string(),
  },
  handler: async (ctx, { requestId, note }) => {
    const { adminId, row } = await review(ctx, requestId, [
      "pending",
      "approved",
    ]);
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "rejected",
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: note.trim() || undefined,
      closedAt: now,
    });
    await createAuditLog(ctx, {
      userId: row.userId,
      actorType: "system",
      actorId: `admin:${adminId}`,
      action: "number_change.rejected",
      resourceType: "number_change_request",
      resourceId: row._id,
    });
  },
});
