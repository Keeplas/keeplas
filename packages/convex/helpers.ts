import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export const TOTP_REQUIRED_ERROR = "TOTP_REQUIRED";
export const LOGIN_OTP_REQUIRED_ERROR = "LOGIN_OTP_REQUIRED";

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
 * Whether the user has a `password` (email + password) auth account. The
 * always-on login-OTP gate applies ONLY to such accounts: passwordless
 * accounts (`phone-otp` / `email-otp`) already cleared an OTP at sign-in, so
 * gating them would double-prompt. Basing the skip on "has a password account"
 * — rather than "has a phone-otp account" — keeps the gate armed for a password
 * account even after it links a phone, closing a step-up bypass.
 */
export async function hasPasswordAccount(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "password"),
    )
    .first();
  return account !== null;
}

/**
 * Like `requireAuth` but additionally enforces the always-on login-OTP
 * step-up: the current Convex Auth session must have cleared a channel OTP.
 * Skipped for passwordless accounts (their sign-in IS an OTP). Throws
 * `"LOGIN_OTP_REQUIRED"` for callers to redirect the client to `/login/otp`.
 */
export async function requireAuthWithLoginOtp(ctx: QueryCtx) {
  const userId = await requireAuth(ctx);
  if (!(await hasPasswordAccount(ctx, userId))) return userId;

  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new Error(LOGIN_OTP_REQUIRED_ERROR);

  const cleared = await ctx.db
    .query("auth_session_login_otp")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  if (!cleared) throw new Error(LOGIN_OTP_REQUIRED_ERROR);

  return userId;
}

/**
 * Steady-state guard for sensitive owner operations. Composes both step-up
 * gates on top of `requireAuth`:
 *   1. login-OTP gate (password accounts only — `requireAuthWithLoginOtp`)
 *   2. TOTP gate (only when TOTP is enrolled — `requireAuthWithTotp`)
 *
 * Reuses the two single-purpose helpers rather than re-implementing their
 * checks (DRY). Throws `"LOGIN_OTP_REQUIRED"` / `"TOTP_REQUIRED"`, which the
 * dashboard layout already reacts to (it polls `getMyLoginOtpGate` /
 * `getMyTotpGate` and redirects to `/login/otp` / `/login/totp`). These throws
 * are the defense-in-depth backstop for a session that bypasses the UI and
 * calls the API directly without clearing the gates.
 *
 * Order: login-OTP first to mirror the layout (login-OTP is the last gate the
 * user clears, but throwing it first is harmless — both must pass).
 */
export async function requireFullAuth(ctx: QueryCtx) {
  await requireAuthWithLoginOtp(ctx);
  return await requireAuthWithTotp(ctx);
}

/**
 * Back-office guard for the keeplas-admin analytics console. Requires an
 * authenticated user whose `role` is "admin". Throws "FORBIDDEN" otherwise so
 * the admin client can distinguish a denied (non-admin) session from an
 * unauthenticated one. Every `admin/*` query starts with this.
 */
export async function requireAdmin(ctx: QueryCtx) {
  const userId = await requireAuth(ctx);
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("FORBIDDEN");
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
 * Get all active (non-archived) vault items for a user. Excludes release
 * introductions — those are authored from /life-check and rendered separately
 * on the memorial page, not in the main /vault listing or hub counters.
 */
export async function getActiveItems(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("vault_items")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.neq(q.field("status"), "archived"),
        q.neq(q.field("isReleaseIntroduction"), true),
      ),
    )
    .collect();
}

/**
 * All vault files that count toward a user's storage footprint: attachments on
 * their active (non-archived) items. Single source of truth shared by
 * `getUsageStats` (display) and the upload quota check (enforcement) so the two
 * never disagree on what "used storage" means.
 */
export async function getActiveVaultFiles(ctx: QueryCtx, userId: Id<"users">) {
  const items = await getActiveItems(ctx, userId);
  const activeItemIds = new Set(items.map((item) => item._id));
  const allFiles = await ctx.db
    .query("vault_item_files")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return allFiles.filter((f) => activeItemIds.has(f.itemId));
}

/**
 * Total encrypted bytes a user currently occupies (sum of `getActiveVaultFiles`
 * sizes). Used by the pre-insert quota gate in vault_items.ts.
 */
export async function getActiveStorageBytes(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<number> {
  const files = await getActiveVaultFiles(ctx, userId);
  return files.reduce((sum, f) => sum + f.size, 0);
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
 * Insert an in-app notification row.
 *
 * TEMPORARILY DISABLED (no-op): the in-app notifications bell is hidden for now
 * because the same events are already surfaced by the logs (Security Center
 * Activity Log + Life Check History). We keep this chokepoint so re-enabling is
 * a one-place change.
 *
 * Out of scope of this disable — unaffected:
 *   - Outbound reminders (web push / email / WhatsApp) go out via
 *     `internal.dispatch.sendChannel`, scheduled separately by the callers.
 *   - Audit logging via `createAuditLog` / the `audit_logs` table.
 */
export function createNotification(
  ctx: MutationCtx,
  input: NotificationInput,
): Promise<void> {
  void ctx;
  void input;
  return Promise.resolve();
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
