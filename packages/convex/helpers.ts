import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export const TOTP_REQUIRED_ERROR = "TOTP_REQUIRED";

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
 * Like `requireAuth` but additionally enforces that, if the user has TOTP
 * enrolled, the current Convex Auth session has cleared the TOTP step.
 *
 * Throws `"TOTP_REQUIRED"` for callers to detect and redirect the client to
 * the TOTP challenge page. Users without TOTP enrolled bypass the gate.
 */
export async function requireAuthWithTotp(ctx: QueryCtx) {
  const userId = await requireAuth(ctx);
  const totp = await ctx.db
    .query("totp_secrets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!totp || !totp.verifiedAt) return userId;

  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new Error(TOTP_REQUIRED_ERROR);

  const cleared = await ctx.db
    .query("auth_session_totp")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  if (!cleared) throw new Error(TOTP_REQUIRED_ERROR);

  return userId;
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
  userId: Id<"users">,
) {
  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) {
    throw new Error("Item not found");
  }
  return item;
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
  input: NotificationInput,
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

/**
 * Resolve which trusted_contacts should receive a vault item on emergency
 * trigger, based on the item's recipientMode + sharedWithGroups + sharedWithContacts.
 *
 * Precedence:
 *   "explicit" → item.sharedWithContacts (intersected with non-revoked).
 *   "groups"   → union of memberContactIds across item.sharedWithGroups.
 *   "default" / undefined → all accepted contacts of contactType "trust".
 */
export async function resolveItemRecipients(
  ctx: QueryCtx,
  item: Doc<"vault_items">,
  userId: Id<"users">,
): Promise<Id<"trusted_contacts">[]> {
  const allContacts = await ctx.db
    .query("trusted_contacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
    .collect();

  const mode = item.recipientMode ?? "default";

  if (mode === "explicit") {
    const allowed = new Set(allContacts.map((c) => c._id));
    return item.sharedWithContacts.filter((id) => allowed.has(id));
  }

  if (mode === "groups") {
    const groupIds = item.sharedWithGroups ?? [];
    if (groupIds.length === 0) return [];
    const groups = await Promise.all(groupIds.map((id) => ctx.db.get(id)));
    const allowed = new Set(allContacts.map((c) => c._id));
    const out = new Set<Id<"trusted_contacts">>();
    for (const group of groups) {
      if (!group || group.userId !== userId) continue;
      for (const cid of group.memberContactIds) {
        if (allowed.has(cid)) out.add(cid);
      }
    }
    return Array.from(out);
  }

  return allContacts
    .filter((c) => {
      const isTrust = (c.contactType ?? "trust") === "trust";
      return isTrust && c.invitationStatus === "accepted";
    })
    .map((c) => c._id);
}
