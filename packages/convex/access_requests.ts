import { v } from "convex/values";
import { query } from "./_generated/server";
import { createNotification, requireAuth } from "./helpers";
import { auditedMutation } from "./audit";

/**
 * Get pending access requests for the vault owner.
 */
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const requests = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", userId).eq("status", "pending")
      )
      .collect();

    const enriched = [];
    for (const req of requests) {
      const contact = await ctx.db.get(req.requestedBy);
      enriched.push({
        ...req,
        contactName: contact?.name ?? "Unknown",
        contactRole: contact?.role ?? "other",
      });
    }
    return enriched;
  },
});

/**
 * Get all access requests for the vault owner.
 */
export const getAccessRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const requests = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", userId))
      .order("desc")
      .collect();

    const enriched = [];
    for (const req of requests) {
      const contact = await ctx.db.get(req.requestedBy);
      enriched.push({
        ...req,
        contactName: contact?.name ?? "Unknown",
        contactRole: contact?.role ?? "other",
      });
    }
    return enriched;
  },
});

/**
 * Mark the vault owner as unreachable from a trusted contact's account.
 * The first call from a given contact creates the request; subsequent calls
 * from other contacts append to `contactsInitiated`. When the count reaches
 * the quorum threshold (2), the 72h grace window opens.
 */
export const markUserUnreachable = auditedMutation({
  action: "access_request.unreachable_marked",
  resourceType: "access_request",
  args: { contactId: v.id("trusted_contacts") },
  resolveActor: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: requesterId,
    };
  },
  getResourceId: (_args, result) => (result as { requestId: string }).requestId,
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== requesterId) {
      throw new Error("Not authorized");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new Error("Contact must be accepted to confirm unreachability");
    }
    if ((contact.contactType ?? "trust") !== "trust") {
      throw new Error("Only trust contacts can confirm unreachability");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", contact.userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .first();

    if (existing) {
      const contactsInitiated = existing.contactsInitiated ?? [];
      if (contactsInitiated.includes(args.contactId)) {
        throw new Error("You have already confirmed unreachability");
      }

      const updatedContacts = [...contactsInitiated, args.contactId];
      const quorumReached = updatedContacts.length >= 2;

      await ctx.db.patch(existing._id, {
        contactsInitiated: updatedContacts,
        quorumReached,
        gracePeriodEndsAt: quorumReached
          ? now + 72 * 60 * 60 * 1000
          : undefined,
        updatedAt: now,
      });

      if (quorumReached) {
        await createNotification(ctx, {
          userId: contact.userId,
          type: "security_alert",
          title: "Emergency access initiated",
          body: "Two or more contacts have confirmed you are unreachable. You have 72 hours to cancel.",
          actionUrl: "/trusted-contacts",
          channels: ["push", "email"],
          relatedId: existing._id,
          relatedType: "access_request",
        });
      }

      return { requestId: existing._id, quorumReached };
    }

    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: contact.userId,
      requestedBy: args.contactId,
      sectionsRequested: ["all"],
      status: "pending",
      autoResponseAt: now + 72 * 60 * 60 * 1000,
      quorumRequired: 2,
      quorumReached: false,
      contactsInitiated: [args.contactId],
      createdAt: now,
      updatedAt: now,
    });

    return { requestId, quorumReached: false };
  },
});

/**
 * Get the active access request for a vault from the perspective of a trust
 * contact. Returns null when no quorum-reached request exists for the owner.
 * Used by the contact UI to decide whether to surface "Submit my shard".
 */
export const getActiveAccessRequestForContact = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== requesterId) return null;

    const request = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) =>
        q.eq("vaultUserId", contact.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!request) return null;
    return request;
  },
});

/**
 * List the OTHER trust contacts of a vault (excluding the caller). The
 * caller must themselves be one of the vault's trust contacts. Returns each
 * peer's public key so the caller can fan-out wrap their submitted shard
 * to every other participant in the recovery quorum.
 */
export const getRecoveryPeers = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);
    const myRow = await ctx.db.get(args.contactId);
    if (!myRow || myRow.contactUserId !== requesterId) {
      throw new Error("Not authorized");
    }
    if ((myRow.contactType ?? "trust") !== "trust") {
      throw new Error("Caller is not a trust contact");
    }

    const peers = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", myRow.userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    return peers
      .filter((p) => p._id !== args.contactId)
      .filter((p) => (p.contactType ?? "trust") === "trust")
      .filter((p) => typeof p.contactPublicKey === "string")
      .map((p) => ({
        contactId: p._id,
        name: p.name,
        contactPublicKey: p.contactPublicKey as string,
      }));
  },
});

/**
 * Submit the calling contact's shard for recovery, fanned out to every
 * other trust contact's public key. The server stores the wrapped envelopes
 * but never sees the raw shard (true zero-knowledge).
 *
 * The caller is responsible for wrapping a copy for each peer. The server
 * verifies the (submitter, recipient) pair is valid for the access request,
 * then inserts a row per submission.
 */
export const submitRecoveryShards = auditedMutation({
  action: "access_request.shards_submitted",
  resourceType: "access_request",
  args: {
    accessRequestId: v.id("access_requests"),
    submitterContactId: v.id("trusted_contacts"),
    submissions: v.array(
      v.object({
        recipientContactId: v.id("trusted_contacts"),
        wrappedShard: v.string(),
      })
    ),
  },
  resolveActor: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.submitterContactId);
    if (!contact) throw new Error("Contact not found");
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: requesterId,
    };
  },
  getResourceId: (args) => args.accessRequestId,
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);

    const submitter = await ctx.db.get(args.submitterContactId);
    if (!submitter || submitter.contactUserId !== requesterId) {
      throw new Error("Not authorized");
    }
    if ((submitter.contactType ?? "trust") !== "trust") {
      throw new Error("Only trust contacts can submit recovery shards");
    }

    const request = await ctx.db.get(args.accessRequestId);
    if (!request || request.vaultUserId !== submitter.userId) {
      throw new Error("Access request mismatch");
    }
    if (!request.quorumReached) {
      throw new Error(
        "Cannot submit shards before unreachability quorum is reached"
      );
    }
    if (
      request.gracePeriodEndsAt &&
      Date.now() < request.gracePeriodEndsAt
    ) {
      throw new Error("Grace period not yet expired");
    }
    if (request.cancelledDuringGrace) {
      throw new Error("Access request was cancelled during grace");
    }

    const existing = await ctx.db
      .query("recovery_shard_submissions")
      .withIndex("by_request_submitter", (q) =>
        q
          .eq("accessRequestId", args.accessRequestId)
          .eq("submitterContactId", args.submitterContactId)
      )
      .collect();
    if (existing.length > 0) {
      throw new Error("You already submitted your shard");
    }

    const now = Date.now();
    let inserted = 0;
    for (const sub of args.submissions) {
      const recipient = await ctx.db.get(sub.recipientContactId);
      if (!recipient || recipient.userId !== submitter.userId) continue;
      if ((recipient.contactType ?? "trust") !== "trust") continue;
      if (recipient._id === submitter._id) continue;

      await ctx.db.insert("recovery_shard_submissions", {
        accessRequestId: args.accessRequestId,
        vaultUserId: submitter.userId,
        submitterContactId: args.submitterContactId,
        recipientContactId: sub.recipientContactId,
        wrappedShard: sub.wrappedShard,
        createdAt: now,
      });
      inserted++;
    }

    return { submitted: inserted };
  },
});

/**
 * Fetch the wrapped-for-me shards for a recovery: every row where the
 * caller's contactId is the recipient. Used by the contact's client to
 * unwrap peer shards and reconstruct the master key on-device.
 */
export const getRecoveryShardsForMe = query({
  args: {
    accessRequestId: v.id("access_requests"),
    contactId: v.id("trusted_contacts"),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== requesterId) return [];

    const rows = await ctx.db
      .query("recovery_shard_submissions")
      .withIndex("by_request_recipient", (q) =>
        q
          .eq("accessRequestId", args.accessRequestId)
          .eq("recipientContactId", args.contactId)
      )
      .collect();

    return rows.map((r) => ({
      submitterContactId: r.submitterContactId,
      wrappedShard: r.wrappedShard,
    }));
  },
});

/**
 * Count distinct submitters for an access request. Useful for the contact
 * UI to show "X of Y submissions received" without exposing which peers.
 */
export const getRecoverySubmissionCount = query({
  args: { accessRequestId: v.id("access_requests") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const request = await ctx.db.get(args.accessRequestId);
    if (!request) return 0;

    const isOwner = request.vaultUserId === userId;
    const callerContact = isOwner
      ? null
      : await ctx.db
          .query("trusted_contacts")
          .withIndex("by_contact_user", (q) => q.eq("contactUserId", userId))
          .filter((q) => q.eq(q.field("userId"), request.vaultUserId))
          .first();
    if (!isOwner && !callerContact) return 0;

    const rows = await ctx.db
      .query("recovery_shard_submissions")
      .withIndex("by_request", (q) =>
        q.eq("accessRequestId", args.accessRequestId)
      )
      .collect();

    const submitters = new Set(rows.map((r) => r.submitterContactId));
    return submitters.size;
  },
});

/**
 * Cancel emergency access during the 72h grace period (vault owner action).
 * Effectively a "I'm alive" signal — closes the request and resets state.
 */
export const cancelEmergencyAccess = auditedMutation({
  action: "access_request.emergency_cancelled",
  resourceType: "access_request",
  getResourceId: (args) => args.requestId,
  args: { requestId: v.id("access_requests") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.vaultUserId !== userId) {
      throw new Error("Request not found");
    }

    const now = Date.now();

    if (request.gracePeriodEndsAt && now > request.gracePeriodEndsAt) {
      throw new Error("Grace period has expired");
    }

    await ctx.db.patch(args.requestId, {
      status: "denied",
      cancelledDuringGrace: true,
      respondedAt: now,
      updatedAt: now,
    });

    if (request.contactsInitiated) {
      for (const contactId of request.contactsInitiated) {
        const contact = await ctx.db.get(contactId);
        if (contact?.contactUserId) {
          await createNotification(ctx, {
            userId: contact.contactUserId,
            type: "security_alert",
            title: "Emergency access cancelled",
            body: "The vault owner cancelled the emergency access request.",
            channels: ["push", "email"],
            relatedId: args.requestId,
            relatedType: "access_request",
          });
        }
      }
    }

    return { success: true };
  },
});
