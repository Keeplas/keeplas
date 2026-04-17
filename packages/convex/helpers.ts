import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { createAuditLog } from "./audit";

/**
 * Require an authenticated user (for mutations). Throws if not authenticated.
 */
export async function requireAuth(ctx: { auth: QueryCtx["auth"] }) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/**
 * Get the authenticated user ID if present (for queries). Returns null if not authenticated.
 */
export async function optionalAuth(ctx: { auth: QueryCtx["auth"] }) {
  return await getAuthUserId(ctx);
}

/**
 * Get the user's vault by userId.
 */
export async function getUserVault(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("vaults")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

/**
 * Get all active (non-archived) vault items for a user.
 */
export async function getActiveItems(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("vault_items")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.neq(q.field("status"), "archived"))
    .collect();
}

/**
 * Verify that the user owns the given item. Returns the item or throws.
 */
export async function requireItemOwnership(
  ctx: QueryCtx,
  itemId: Id<"vault_items">,
  userId: Id<"users">
) {
  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) {
    throw new Error("Item not found");
  }
  return item;
}

/**
 * Log a vault item action (create/update/archive).
 */
export async function logVaultAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: string,
  itemId: Id<"vault_items">
) {
  await createAuditLog(ctx, {
    userId,
    actorType: "user",
    actorId: userId,
    action,
    resourceType: "vault_item",
    resourceId: itemId,
  });
}

export type NotificationType =
  | "life_check"
  | "access_request"
  | "contact_invited"
  | "contact_confirmed"
  | "vault_update"
  | "security_alert"
  | "system";

export interface NotificationInput {
  userId: Id<"users">;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  channels?: string[];
  relatedId?: string;
  relatedType?: string;
}

/**
 * Insert a notification row. Defaults channels to ["push"] and stamps createdAt.
 */
export async function createNotification(
  ctx: MutationCtx,
  input: NotificationInput
) {
  return await ctx.db.insert("notifications", {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    channels: input.channels ?? ["push"],
    isRead: false,
    relatedId: input.relatedId,
    relatedType: input.relatedType,
    createdAt: Date.now(),
  });
}
