import { v, ConvexError } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { auditedMutation } from "./audit";
import { requireFullAuth } from "./helpers";
import {
  CAPTURE_HANDOFF_EXPIRED,
  CAPTURE_HANDOFF_INVALID,
  CAPTURE_QR_TTL_MS,
} from "./lib/capture_qr";

/**
 * W06-7 "Scan with my phone" (capture handoff):
 *
 *   browser  create                      → waiting (QR, 2 min)
 *   phone    claim (same account)        → claimed, opens the scanner
 *   phone    createItem(captureHandoffId) → completed, itemId
 *   browser  get                         → opens the item
 *
 * Pages are sealed on the phone like any capture; the handoff only links
 * the two screens. Rows are purged an hour after creation.
 */

const PURGE_AFTER_MS = 60 * 60 * 1000;

/** Browser: a new QR (any earlier waiting one stops working). */
export const create = auditedMutation({
  action: "capture.handoff.created",
  resourceType: "capture_handoff",
  getResourceId: (_args, result) => (result as { handoffId: string }).handoffId,
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const now = Date.now();
    const previous = await ctx.db
      .query("capture_handoffs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const handoff of previous) {
      if (handoff.status === "waiting") await ctx.db.delete(handoff._id);
    }
    const expiresAt = now + CAPTURE_QR_TTL_MS;
    const handoffId = await ctx.db.insert("capture_handoffs", {
      userId,
      status: "waiting",
      expiresAt,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(
      PURGE_AFTER_MS,
      internal.capture_handoffs.purge,
      { handoffId },
    );
    return { handoffId, expiresAt };
  },
});

/** Browser: where the handoff is; null once purged or not the owner's. */
export const get = query({
  args: { handoffId: v.id("capture_handoffs") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const handoff = await ctx.db.get(args.handoffId);
    if (!handoff || handoff.userId !== userId) return null;
    return {
      status: handoff.status,
      expiresAt: handoff.expiresAt,
      itemId: handoff.itemId ?? null,
    };
  },
});

/** Phone: the owner scanned the QR; the scanner opens. */
export const claim = auditedMutation({
  action: "capture.handoff.claimed",
  resourceType: "capture_handoff",
  getResourceId: (args) => args.handoffId,
  args: { handoffId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const handoffId = ctx.db.normalizeId("capture_handoffs", args.handoffId);
    const handoff = handoffId ? await ctx.db.get(handoffId) : null;
    if (!handoff || handoff.userId !== userId) {
      throw new ConvexError(CAPTURE_HANDOFF_INVALID);
    }
    if (handoff.status !== "waiting" || handoff.expiresAt <= Date.now()) {
      throw new ConvexError(CAPTURE_HANDOFF_EXPIRED);
    }
    await ctx.db.patch(handoff._id, { status: "claimed" });
  },
});

/**
 * createItem with `captureHandoffId`: the scan the browser waits for is
 * saved. Ignored (the item still saves) for a handoff that is not the
 * owner's or not claimed, e.g. purged while the phone was offline.
 */
export async function completeHandoff(
  ctx: MutationCtx,
  userId: Id<"users">,
  handoffId: Id<"capture_handoffs">,
  itemId: Id<"vault_items">,
) {
  const handoff = await ctx.db.get(handoffId);
  if (!handoff || handoff.userId !== userId || handoff.status !== "claimed") {
    return;
  }
  await ctx.db.patch(handoffId, { status: "completed", itemId });
}

export const purge = internalMutation({
  args: { handoffId: v.id("capture_handoffs") },
  handler: async (ctx, args) => {
    if (await ctx.db.get(args.handoffId)) await ctx.db.delete(args.handoffId);
  },
});
