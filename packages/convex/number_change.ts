import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  auditContextValidator,
  auditedMutation,
  createAuditLog,
  verifyAuditContext,
} from "./audit";
import { optionalAuth, requireAuth } from "./helpers";
import { activePushTokens } from "./devices";
import { constantTimeStringEquals, sha256Hex } from "./lib/crypto";
import { isValidEmail, normalizeEmail } from "./lib/email";
import { checkOtp, generateOtp, INVALID_CODE } from "./lib/otp";
import { maskPhone, normalizeE164 } from "./lib/phone";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { endSessions } from "./lib/sessions";
import { assertPhoneAvailable, commitPhoneChange } from "./phone_verification";
import { RECOVERY_REQUEST_TTL_MS, RECOVERY_WINDOW_MS } from "./recovery";

/**
 * Lost number without the 24 words (cases B / D / F). Signed out, the user
 * asks to move the account to a new number. Nothing happens for 72 h (D3):
 * the owner is alerted on every channel and "It wasn't me" cancels, while
 * support checks the declared, non-encrypted details in the admin console
 * (admin/recovery_requests.ts). Once approved and past the window, a
 * WhatsApp code to the new number completes it: the number changes, every
 * other session ends, and the phone signs in (`number-change` provider).
 * The vault stays closed: it still needs the cloud backup, the 24 words or
 * two contacts. With the 24 words, `phone-recovery` is immediate instead.
 * Like a contact recovery, a request lapses 7 days after it was made.
 */

const SUBMIT_MAX_PER_IP = 5;
const SUBMIT_MAX_PER_PHONE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_WINDOW_MS = 60 * 60 * 1000;
const CODE_MAX_PER_WINDOW = 3;
const MESSAGE_MAX_LENGTH = 1000;

const OPEN_STATUSES: Doc<"number_change_requests">["status"][] = [
  "pending",
  "approved",
];

const isExpired = (row: Doc<"number_change_requests">) =>
  Date.now() >= row.createdAt + RECOVERY_REQUEST_TTL_MS;

const isOpen = (row: Doc<"number_change_requests">) =>
  OPEN_STATUSES.includes(row.status) && !isExpired(row);

async function openRequest(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("number_change_requests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.find(isOpen) ?? null;
}

/** The request, if `claimToken` is the secret its phone was given. */
async function claimedRequest(
  ctx: QueryCtx,
  requestId: Id<"number_change_requests">,
  claimToken: string,
) {
  const row = await ctx.db.get(requestId);
  if (!row) return null;
  return constantTimeStringEquals(row.claimHash, await sha256Hex(claimToken))
    ? row
    : null;
}

/** Approved by support, past the 72 h window, not lapsed. */
const isReady = (row: Doc<"number_change_requests">) =>
  row.status === "approved" &&
  Date.now() >= row.windowEndsAt &&
  !isExpired(row);

const claimArgs = {
  requestId: v.id("number_change_requests"),
  claimToken: v.string(),
};

/**
 * Start a request, signed out. Rate-limited per IP and per old number; one
 * open request per account. Returns the claim secret the phone keeps.
 */
export const submit = mutation({
  args: {
    oldPhone: v.string(),
    newPhone: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "number_change",
      args._audit.ip,
      SUBMIT_MAX_PER_IP,
    );
    const oldPhone = normalizeE164(args.oldPhone);
    const newPhone = normalizeE164(args.newPhone);
    if (!oldPhone || !newPhone) throw new ConvexError("INVALID_PHONE");
    if (oldPhone === newPhone) throw new ConvexError("SAME_NUMBER");
    const name = args.name.trim();
    if (!name) throw new ConvexError("NAME_REQUIRED");
    const email = args.email?.trim() ? normalizeEmail(args.email) : undefined;
    if (email && !isValidEmail(email)) throw new ConvexError("INVALID_EMAIL");
    const message = args.message?.trim().slice(0, MESSAGE_MAX_LENGTH);

    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", oldPhone))
      .first();
    if (!user) throw new ConvexError("NO_ACCOUNT");
    await enforceIpRateLimit(
      ctx,
      "number_change_phone",
      oldPhone,
      SUBMIT_MAX_PER_PHONE,
      DAY_MS,
    );
    if (await openRequest(ctx, user._id)) {
      throw new ConvexError("REQUEST_IN_PROGRESS");
    }
    await assertPhoneAvailable(ctx, newPhone, user._id);

    const claimToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const now = Date.now();
    const windowEndsAt = now + RECOVERY_WINDOW_MS;
    const requestId = await ctx.db.insert("number_change_requests", {
      userId: user._id,
      oldPhone,
      newPhone,
      declaredName: name,
      declaredEmail: email,
      message: message || undefined,
      status: "pending",
      claimHash: await sha256Hex(claimToken),
      createdAt: now,
      windowEndsAt,
    });
    await createAuditLog(ctx, {
      userId: user._id,
      actorType: "system",
      actorId: "number_change",
      action: "number_change.requested",
      resourceType: "number_change_request",
      resourceId: requestId,
      metadata: JSON.stringify({ newPhone: maskPhone(newPhone) }),
      ipAddress: args._audit.ip,
      country: args._audit.country,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.dispatch.notifyNumberChangeRequested,
      {
        email: user.email,
        phoneNumber: oldPhone,
        ownerName: user.name,
        language: user.language,
        pushTokens: await activePushTokens(ctx, user._id),
      },
    );
    await ctx.scheduler.runAfter(0, internal.support.notifyRecoveryReviewer, {
      requestId,
      declaredName: name,
      declaredEmail: email,
      message: message || undefined,
      oldPhone,
      newPhone,
      accountName: user.name,
      accountEmail: user.email,
      accountCreatedAt: user._creationTime,
      windowEndsAt,
    });
    return { requestId, claimToken, windowEndsAt };
  },
});

/** The requesting phone follows its request (no session yet). */
export const status = query({
  args: claimArgs,
  handler: async (ctx, { requestId, claimToken }) => {
    const row = await claimedRequest(ctx, requestId, claimToken);
    if (!row) return null;
    return {
      status: row.status,
      expired: isExpired(row),
      createdAt: row.createdAt,
      windowEndsAt: row.windowEndsAt,
      newPhoneMasked: maskPhone(row.newPhone),
    };
  },
});

/** The requester withdraws it (wrong new number, found the old one…). */
export const withdraw = mutation({
  args: claimArgs,
  handler: async (ctx, { requestId, claimToken }) => {
    const row = await claimedRequest(ctx, requestId, claimToken);
    if (!row || !isOpen(row)) throw new ConvexError("NO_OPEN_REQUEST");
    await ctx.db.patch(row._id, { status: "cancelled", closedAt: Date.now() });
    await createAuditLog(ctx, {
      userId: row.userId,
      actorType: "system",
      actorId: "number_change",
      action: "number_change.withdrawn",
      resourceType: "number_change_request",
      resourceId: row._id,
    });
  },
});

/** Approved and past the window: send the code to the new number. */
export const requestCompletionCode = mutation({
  args: claimArgs,
  handler: async (ctx, { requestId, claimToken }) => {
    const row = await claimedRequest(ctx, requestId, claimToken);
    if (!row || !isReady(row)) throw new ConvexError("NOT_READY");

    const now = Date.now();
    const recent = (
      await ctx.db
        .query("phone_auth_codes")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", row.newPhone))
        .collect()
    ).filter(
      (c) =>
        c.intent === "number_change" && c._creationTime > now - CODE_WINDOW_MS,
    );
    if (recent.length >= CODE_MAX_PER_WINDOW) {
      throw new ConvexError("Too many verification attempts. Try again later.");
    }
    for (const stale of recent) {
      if (stale.expiresAt > now)
        await ctx.db.patch(stale._id, { expiresAt: now });
    }
    const code = generateOtp();
    await ctx.db.insert("phone_auth_codes", {
      phoneNumber: row.newPhone,
      codeHash: await sha256Hex(code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      intent: "number_change",
    });
    const user = await ctx.db.get(row.userId);
    await ctx.scheduler.runAfter(0, internal.dispatch.sendWhatsAppOtp, {
      phoneNumber: row.newPhone,
      code,
      language: user?.language,
    });
    return { sent: true };
  },
});

/**
 * The `number-change` provider's check (auth.ts): ready request + the code
 * sent to the new number. Commits the number, ends every session (the lost
 * phone's too) and returns the user to sign in. A wrong code is returned,
 * not thrown, so the attempt is counted (lib/otp.ts).
 */
export const complete = internalMutation({
  args: { ...claimArgs, code: v.string() },
  handler: async (ctx, { requestId, claimToken, code }) => {
    const row = await claimedRequest(ctx, requestId, claimToken);
    if (!row || !isReady(row)) throw new ConvexError("NOT_READY");
    const candidates = (
      await ctx.db
        .query("phone_auth_codes")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", row.newPhone))
        .collect()
    ).filter((c) => c.intent === "number_change");
    const check = await checkOtp(ctx, candidates, code);
    if ("wrong" in check) return { ok: false as const, error: INVALID_CODE };

    await ctx.db.delete(check.active._id);
    await commitPhoneChange(ctx, row.userId, row.newPhone);
    await ctx.db.patch(row._id, { status: "completed", closedAt: Date.now() });
    await endSessions(ctx, row.userId);
    await createAuditLog(ctx, {
      userId: row.userId,
      actorType: "system",
      actorId: "number_change",
      action: "number_change.completed",
      resourceType: "number_change_request",
      resourceId: row._id,
      metadata: JSON.stringify({
        previousPhone: maskPhone(row.oldPhone),
        newPhone: maskPhone(row.newPhone),
      }),
    });
    const user = await ctx.db.get(row.userId);
    await ctx.scheduler.runAfter(0, internal.dispatch.notifyNewDevice, {
      email: user?.email,
      phoneNumber: row.newPhone,
      ownerName: user?.name,
      deviceLabel: "A phone using your new number",
      language: user?.language,
    });
    return { ok: true as const, userId: row.userId };
  },
});

/** Owner side: a request in progress on the account, to cancel if not me. */
export const getMineOpen = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const row = await openRequest(ctx, userId);
    if (!row) return null;
    return {
      requestId: row._id,
      status: row.status,
      createdAt: row.createdAt,
      windowEndsAt: row.windowEndsAt,
      newPhoneMasked: maskPhone(row.newPhone),
    };
  },
});

/** "It wasn't me": any signed-in session of the owner cancels it. */
export const cancel = auditedMutation({
  action: "number_change.cancelled",
  resourceType: "number_change_request",
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const row = await openRequest(ctx, userId);
    if (!row) throw new ConvexError("NO_OPEN_REQUEST");
    await ctx.db.patch(row._id, { status: "cancelled", closedAt: Date.now() });
    return row._id;
  },
  getResourceId: (_args, requestId) => requestId,
});
