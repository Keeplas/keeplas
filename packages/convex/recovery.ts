import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  auditContextValidator,
  auditedMutation,
  createAuditLog,
  verifyAuditContext,
} from "./audit";
import { optionalAuth, requireAuth, requireFullAuth } from "./helpers";
import { activePushTokens } from "./devices";

/**
 * Owner recovery with trust contacts (v2 workflow 7, F3, D3, D4).
 *
 *   pending → approved_1 → approved_2 → released → rotated
 *   any active → cancelled (owner) · rejected (a contact) · expired (7 days)
 *
 * G is released (sealed to the new device key) by `recovery_node.release`
 * only once 2 contacts approved AND the 72 h window has elapsed.
 */

export const RECOVERY_WINDOW_MS = 72 * 60 * 60 * 1000;
export const RECOVERY_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RECOVERY_THRESHOLD = 2;
const MAX_TRUST_CONTACTS = 3;
const ML_KEM_768_PUBLIC_KEY_LENGTH = 1580; // base64 of 1184 bytes

const ACTIVE = ["pending", "approved_1", "approved_2", "released"] as const;
const OPEN_FOR_APPROVAL = ["pending", "approved_1"] as const;
type Status = Doc<"recovery_requests">["status"];
const isOneOf = (status: Status, list: readonly Status[]) =>
  list.includes(status);

/** Accepted trust contacts that own a key pair (eligible for an RS share). */
async function eligibleTrustContacts(ctx: QueryCtx, ownerId: Id<"users">) {
  const contacts = await ctx.db
    .query("trusted_contacts")
    .withIndex("by_user", (q) => q.eq("userId", ownerId))
    .collect();
  return contacts.filter(
    (c) =>
      c.contactType !== "recipient_only" &&
      c.invitationStatus === "accepted" &&
      c.contactUserId !== undefined &&
      c.contactPublicKey !== undefined,
  );
}

async function currentEnvelope(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("social_envelopes")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

async function sharesOf(
  ctx: QueryCtx,
  userId: Id<"users">,
  generation: number,
) {
  return await ctx.db
    .query("recovery_secret_shares")
    .withIndex("by_user_generation", (q) =>
      q.eq("userId", userId).eq("generation", generation),
    )
    .collect();
}

async function activeRequest(ctx: QueryCtx, userId: Id<"users">) {
  const requests = await ctx.db
    .query("recovery_requests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return requests.find((r) => isOneOf(r.status, ACTIVE)) ?? null;
}

async function approvalsOf(ctx: QueryCtx, requestId: Id<"recovery_requests">) {
  return await ctx.db
    .query("recovery_approvals")
    .withIndex("by_request", (q) => q.eq("requestId", requestId))
    .collect();
}

// ─── Setup (owner device) ────────────────────────────────────────────────

/** Owner: trust contacts to seal RS shares to, and the next generation. */
export const getSetupTargets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const contacts = await eligibleTrustContacts(ctx, userId);
    const envelope = await currentEnvelope(ctx, userId);
    return {
      nextGeneration: (envelope?.generation ?? 0) + 1,
      contacts: contacts.slice(0, MAX_TRUST_CONTACTS).map((c) => ({
        contactId: c._id,
        name: c.name,
        publicKey: c.contactPublicKey!,
        identityPublicKey: c.contactIdentityPublicKey,
        publicKeySignature: c.contactPublicKeySignature,
        pinnedIdentityFingerprint: c.pinnedIdentityFingerprint,
      })),
    };
  },
});

/**
 * Store a new generation (called by `recovery_node.setup` once G is under
 * KMS). Replaces the previous generation. When `completesRequestId` is set,
 * this is the post-recovery renewal and the request becomes `rotated`.
 */
export const storeSetup = internalMutation({
  args: {
    generation: v.number(),
    socialEnvelope: v.string(),
    shares: v.array(
      v.object({
        contactId: v.id("trusted_contacts"),
        wrappedShare: v.string(),
      }),
    ),
    gateKeyCiphertext: v.string(),
    completesRequestId: v.optional(v.id("recovery_requests")),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    const userId = await requireFullAuth(ctx);
    const previous = await currentEnvelope(ctx, userId);
    if (args.generation !== (previous?.generation ?? 0) + 1) {
      throw new ConvexError("Stale recovery generation");
    }
    const eligible = new Set(
      (await eligibleTrustContacts(ctx, userId)).map((c) => c._id),
    );
    const contactIds = new Set(args.shares.map((s) => s.contactId));
    if (
      contactIds.size !== args.shares.length ||
      args.shares.length < RECOVERY_THRESHOLD ||
      args.shares.length > MAX_TRUST_CONTACTS ||
      args.shares.some((s) => !eligible.has(s.contactId))
    ) {
      throw new ConvexError("Recovery needs 2 or 3 accepted trust contacts");
    }

    if (args.completesRequestId) {
      const request = await ctx.db.get(args.completesRequestId);
      if (request?.userId !== userId || request.status !== "released") {
        throw new ConvexError("No released recovery to complete");
      }
      await ctx.db.patch(request._id, {
        status: "rotated",
        wrappedGateKey: undefined,
        closedAt: Date.now(),
      });
    }

    if (previous) {
      for (const share of await sharesOf(ctx, userId, previous.generation)) {
        await ctx.db.delete(share._id);
      }
      const oldGates = await ctx.db
        .query("gate_keys")
        .withIndex("by_user_generation", (q) =>
          q.eq("userId", userId).eq("generation", previous.generation),
        )
        .collect();
      for (const gate of oldGates) await ctx.db.delete(gate._id);
      await ctx.db.delete(previous._id);
    }

    const now = Date.now();
    await ctx.db.insert("social_envelopes", {
      userId,
      generation: args.generation,
      envelope: args.socialEnvelope,
      createdAt: now,
    });
    for (const share of args.shares) {
      await ctx.db.insert("recovery_secret_shares", {
        userId,
        contactId: share.contactId,
        generation: args.generation,
        wrappedShare: share.wrappedShare,
      });
    }
    await ctx.db.insert("gate_keys", {
      userId,
      generation: args.generation,
      kmsCiphertext: args.gateKeyCiphertext,
    });
    await ctx.db.patch(userId, {
      socialRecoveryRenewalRequired: undefined,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "recovery.setup.stored",
      resourceType: "social_envelope",
      resourceId: userId,
      metadata: JSON.stringify({
        generation: args.generation,
        contacts: args.shares.length,
        completesRequestId: args.completesRequestId ?? null,
      }),
      ipAddress: args._audit.ip,
      country: args._audit.country,
    });
  },
});

// ─── Request (new device) ────────────────────────────────────────────────

/**
 * New device, signed in by phone OTP (identification only): open a request.
 * Contacts and the owner's other devices are alerted.
 */
export const start = auditedMutation({
  action: "recovery.request.started",
  resourceType: "recovery_request",
  args: { newDevicePublicKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.newDevicePublicKey.length !== ML_KEM_768_PUBLIC_KEY_LENGTH) {
      throw new ConvexError("Invalid device key");
    }
    const envelope = await currentEnvelope(ctx, userId);
    const shares = envelope
      ? await sharesOf(ctx, userId, envelope.generation)
      : [];
    if (!envelope || shares.length < RECOVERY_THRESHOLD) {
      throw new ConvexError("FEWER_THAN_2_CONTACTS");
    }
    if (await activeRequest(ctx, userId)) {
      throw new ConvexError("A recovery request is already in progress");
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("recovery_requests", {
      userId,
      generation: envelope.generation,
      newDevicePublicKey: args.newDevicePublicKey,
      status: "pending",
      windowEndsAt: now + RECOVERY_WINDOW_MS,
      expiresAt: now + RECOVERY_REQUEST_TTL_MS,
      createdAt: now,
    });
    await ctx.scheduler.runAt(
      now + RECOVERY_WINDOW_MS,
      internal.recovery_node.release,
      {
        requestId,
      },
    );
    await ctx.scheduler.runAt(
      now + RECOVERY_REQUEST_TTL_MS,
      internal.recovery.expire,
      { requestId },
    );

    const user = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.dispatch.notifyRecoveryStarted, {
      email: user?.email,
      phoneNumber: user?.phoneNumber,
      ownerName: user?.name,
      language: user?.language,
      pushTokens: await activePushTokens(ctx, userId),
    });
    for (const share of shares) {
      const contact = await ctx.db.get(share.contactId);
      if (!contact) continue;
      const contactUser = contact.contactUserId
        ? await ctx.db.get(contact.contactUserId)
        : null;
      await ctx.scheduler.runAfter(0, internal.dispatch.notifyRecoveryContact, {
        pushTokens: contactUser
          ? await activePushTokens(ctx, contactUser._id)
          : [],
        email: contact.email,
        phoneNumber: contact.phoneNumber,
        contactName: contact.name,
        ownerName: user?.name ?? "A Keeplas user",
        language: user?.language,
      });
    }
    return requestId;
  },
  getResourceId: (_args, requestId) => requestId,
});

/**
 * Owner side, any session (M02-2, M09-4): the latest request with its
 * approvals. The new device computes the 6-digit code from
 * (requestId, newDevicePublicKey) locally.
 */
export const getMyRequest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const request = await ctx.db
      .query("recovery_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!request) return null;
    const approvals = await approvalsOf(ctx, request._id);
    const shares = await sharesOf(ctx, userId, request.generation);
    const contacts = await Promise.all(
      shares.map(async (share) => {
        const contact = await ctx.db.get(share.contactId);
        const decision = approvals.find((a) => a.contactId === share.contactId);
        return {
          contactId: share.contactId,
          name: contact?.name ?? "",
          decision: decision?.decision ?? null,
          rejectReason: decision?.rejectReason ?? null,
          decidedAt: decision?.createdAt ?? null,
        };
      }),
    );
    return {
      requestId: request._id,
      status: request.status,
      newDevicePublicKey: request.newDevicePublicKey,
      createdAt: request.createdAt,
      windowEndsAt: request.windowEndsAt,
      expiresAt: request.expiresAt,
      contacts,
    };
  },
});

/**
 * Close the active request from any owner session (cancel button, or
 * "It wasn't me"). If contacts already re-sealed shares to the requesting
 * device, RS is considered exposed and the owner must renew the setup.
 * Returns whether a request was cancelled.
 */
export async function cancelActiveRecovery(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const request = await activeRequest(ctx, userId);
  if (!request) return false;
  await ctx.db.patch(request._id, {
    status: "cancelled",
    wrappedGateKey: undefined,
    closedAt: Date.now(),
  });
  const approvals = await approvalsOf(ctx, request._id);
  if (approvals.some((a) => a.wrappedShareForDevice !== undefined)) {
    await ctx.db.patch(userId, { socialRecoveryRenewalRequired: true });
  }
  return true;
}

export const cancel = auditedMutation({
  action: "recovery.request.cancelled",
  resourceType: "recovery_request",
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!(await cancelActiveRecovery(ctx, userId))) {
      throw new ConvexError("No recovery request in progress");
    }
  },
});

// ─── Contacts (M02-3, M09-5) ─────────────────────────────────────────────

/** Contact side: requests waiting for my decision, with my sealed share. */
export const getRequestsForMe = query({
  args: {},
  handler: async (ctx) => {
    const me = await optionalAuth(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", me))
      .collect();
    const out = [];
    for (const contact of rows) {
      if (contact.invitationStatus !== "accepted") continue;
      const request = await activeRequest(ctx, contact.userId);
      if (!request || !isOneOf(request.status, OPEN_FOR_APPROVAL)) continue;
      const share = (
        await sharesOf(ctx, contact.userId, request.generation)
      ).find((s) => s.contactId === contact._id);
      if (!share) continue;
      const decided = (await approvalsOf(ctx, request._id)).some(
        (a) => a.contactId === contact._id,
      );
      if (decided) continue;
      const owner = await ctx.db.get(contact.userId);
      out.push({
        requestId: request._id,
        contactId: contact._id,
        ownerUserId: contact.userId,
        ownerName: owner?.name ?? "",
        newDevicePublicKey: request.newDevicePublicKey,
        generation: request.generation,
        wrappedShare: share.wrappedShare,
        createdAt: request.createdAt,
      });
    }
    return out;
  },
});

/** The caller's contact row for this request's owner, with a share in it. */
async function requireContactForRequest(
  ctx: QueryCtx,
  requestId: Id<"recovery_requests">,
) {
  const me = await requireFullAuth(ctx);
  const request = await ctx.db.get(requestId);
  if (!request) throw new ConvexError("Unknown recovery request");
  for (const share of await sharesOf(ctx, request.userId, request.generation)) {
    const contact = await ctx.db.get(share.contactId);
    if (
      contact?.contactUserId === me &&
      contact.invitationStatus === "accepted"
    ) {
      return { request, contact };
    }
  }
  throw new ConvexError("You are not a trust contact for this request");
}

const contactActor = async (
  ctx: MutationCtx,
  args: { requestId: Id<"recovery_requests"> },
) => {
  const me = await requireAuth(ctx);
  const request = await ctx.db.get(args.requestId);
  if (!request) throw new ConvexError("Unknown recovery request");
  return {
    chainUserId: request.userId,
    actorType: "trusted_contact" as const,
    actorId: me,
  };
};

async function requireUndecided(
  ctx: QueryCtx,
  request: Doc<"recovery_requests">,
  contactId: Id<"trusted_contacts">,
) {
  if (!isOneOf(request.status, OPEN_FOR_APPROVAL)) {
    throw new ConvexError("This recovery request is closed");
  }
  const decided = (await approvalsOf(ctx, request._id)).some(
    (a) => a.contactId === contactId,
  );
  if (decided) throw new ConvexError("You already answered this request");
}

/**
 * Contact approves after comparing the code on a call: posts its RS share
 * re-sealed to the device key, signed with its identity key.
 */
export const approve = auditedMutation({
  action: "recovery.request.approved",
  resourceType: "recovery_request",
  args: {
    requestId: v.id("recovery_requests"),
    wrappedShareForDevice: v.string(),
    signature: v.string(),
  },
  resolveActor: contactActor,
  handler: async (ctx, args) => {
    const { request, contact } = await requireContactForRequest(
      ctx,
      args.requestId,
    );
    await requireUndecided(ctx, request, contact._id);
    const now = Date.now();
    await ctx.db.insert("recovery_approvals", {
      requestId: request._id,
      contactId: contact._id,
      decision: "approve",
      wrappedShareForDevice: args.wrappedShareForDevice,
      signature: args.signature,
      createdAt: now,
    });
    const status = request.status === "pending" ? "approved_1" : "approved_2";
    await ctx.db.patch(request._id, { status });
    // The window may already be over: release right away.
    if (status === "approved_2" && now >= request.windowEndsAt) {
      await ctx.scheduler.runAfter(0, internal.recovery_node.release, {
        requestId: request._id,
      });
    }
  },
  getResourceId: (args) => args.requestId,
});

/** Contact refuses, or reports that the code did not match (M09-5). */
export const reject = auditedMutation({
  action: "recovery.request.rejected",
  resourceType: "recovery_request",
  args: {
    requestId: v.id("recovery_requests"),
    reason: v.union(v.literal("declined"), v.literal("code_mismatch")),
  },
  resolveActor: contactActor,
  handler: async (ctx, args) => {
    const { request, contact } = await requireContactForRequest(
      ctx,
      args.requestId,
    );
    await requireUndecided(ctx, request, contact._id);
    const now = Date.now();
    await ctx.db.insert("recovery_approvals", {
      requestId: request._id,
      contactId: contact._id,
      decision: "reject",
      rejectReason: args.reason,
      createdAt: now,
    });
    await ctx.db.patch(request._id, { status: "rejected", closedAt: now });
    const approvals = await approvalsOf(ctx, request._id);
    if (approvals.some((a) => a.wrappedShareForDevice !== undefined)) {
      await ctx.db.patch(request.userId, {
        socialRecoveryRenewalRequired: true,
      });
    }
  },
  getResourceId: (args) => args.requestId,
  getMetadata: (args) => ({ reason: args.reason }),
});

// ─── Expiry and release ──────────────────────────────────────────────────

/** Scheduled at createdAt + 7 days. */
export const expire = internalMutation({
  args: { requestId: v.id("recovery_requests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || !isOneOf(request.status, OPEN_FOR_APPROVAL)) return;
    await ctx.db.patch(request._id, {
      status: "expired",
      closedAt: Date.now(),
    });
  },
});

/** For `recovery_node.release`: the request if it may be released now. */
export const getReleasable = internalQuery({
  args: { requestId: v.id("recovery_requests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.status !== "approved_2" ||
      Date.now() < request.windowEndsAt
    ) {
      return null;
    }
    const gate = await ctx.db
      .query("gate_keys")
      .withIndex("by_user_generation", (q) =>
        q.eq("userId", request.userId).eq("generation", request.generation),
      )
      .first();
    if (!gate) return null;
    return {
      userId: request.userId,
      newDevicePublicKey: request.newDevicePublicKey,
      kmsCiphertext: gate.kmsCiphertext,
    };
  },
});

/**
 * Re-checks the state in the same transaction as the write: a cancel that
 * raced the KMS call wins and G is never stored for the device.
 */
export const markReleased = internalMutation({
  args: { requestId: v.id("recovery_requests"), wrappedGateKey: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.status !== "approved_2" ||
      Date.now() < request.windowEndsAt
    ) {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "released",
      wrappedGateKey: args.wrappedGateKey,
      releasedAt: now,
    });
    await createAuditLog(ctx, {
      userId: request.userId,
      actorType: "system",
      actorId: "recovery_node.release",
      action: "recovery.request.released",
      resourceType: "recovery_request",
      resourceId: request._id,
    });
    return true;
  },
});

/** New device, after release: everything it needs to rebuild the MasterKey. */
export const getReleasePackage = query({
  args: { requestId: v.id("recovery_requests") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);
    if (
      request?.userId !== userId ||
      request.status !== "released" ||
      !request.wrappedGateKey
    ) {
      return null;
    }
    const envelope = await currentEnvelope(ctx, userId);
    if (envelope?.generation !== request.generation) return null;
    const approvals = (await approvalsOf(ctx, request._id)).filter(
      (a) => a.decision === "approve",
    );
    return {
      generation: request.generation,
      newDevicePublicKey: request.newDevicePublicKey,
      wrappedGateKey: request.wrappedGateKey,
      socialEnvelope: envelope.envelope,
      approvals: await Promise.all(
        approvals.map(async (a) => ({
          contactId: a.contactId,
          wrappedShareForDevice: a.wrappedShareForDevice!,
          signature: a.signature!,
          contactIdentityPublicKey:
            (await ctx.db.get(a.contactId))?.contactIdentityPublicKey ?? "",
        })),
      ),
    };
  },
});

/** Recovery health for M09-10 / W04-5: which ways back in are set up. */
export const getHealth = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const envelope = await currentEnvelope(ctx, userId);
    const shares = envelope
      ? await sharesOf(ctx, userId, envelope.generation)
      : [];
    const eligible = await eligibleTrustContacts(ctx, userId);
    const shared = new Set(shares.map((s) => s.contactId as string));
    const contactsChanged =
      eligible.length >= RECOVERY_THRESHOLD &&
      (eligible.length !== shares.length ||
        eligible.some((c) => !shared.has(c._id)));
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      trustContacts: {
        configured: shares.length >= RECOVERY_THRESHOLD,
        contactCount: shares.length,
        eligibleCount: eligible.length,
        renewalRequired:
          !!user?.socialRecoveryRenewalRequired || contactsChanged,
      },
      recoveryKit: !!user?.recoveryVerified,
      activeDevices: devices.filter((d) => d.revokedAt === undefined).length,
    };
  },
});
