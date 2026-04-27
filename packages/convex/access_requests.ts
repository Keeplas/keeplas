import { v } from "convex/values";
import { query } from "./_generated/server";
import { createNotification, requireAuth } from "./helpers";
import { auditedMutation } from "./audit";

/**
 * Create a Mode B1 access request (on-demand, from trusted contact).
 */
export const requestAccess = auditedMutation({
  action: "access_request.created",
  resourceType: "access_request",
  args: {
    contactId: v.id("trusted_contacts"),
    reason: v.string(),
    sectionsRequested: v.array(v.string()),
  },
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
  getMetadata: (args) => ({ mode: "mode_b1", reason: args.reason }),
  handler: async (ctx, args) => {
    const requesterId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== requesterId) {
      throw new Error("You are not authorized to make this request");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new Error("Contact must be accepted to request access");
    }
    if (!contact.accessModes.includes("mode_b1")) {
      throw new Error("You do not have on-demand access permission");
    }

    const existingRequest = await ctx.db
      .query("access_requests")
      .withIndex("by_requester", (q) => q.eq("requestedBy", args.contactId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("You already have a pending access request");
    }

    const now = Date.now();
    const autoResponseAt = now + 24 * 60 * 60 * 1000;

    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: contact.userId,
      requestedBy: args.contactId,
      accessMode: "mode_b1",
      sectionsRequested: args.sectionsRequested,
      status: "pending",
      autoResponseAt,
      reason: args.reason,
      createdAt: now,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: contact.userId,
      type: "access_request",
      title: "Access request",
      body: `${contact.name} is requesting access to your vault.`,
      actionUrl: "/trusted-contacts",
      channels: ["push", "email"],
      relatedId: requestId,
      relatedType: "access_request",
    });

    return { requestId };
  },
});

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
 * Approve an access request (vault owner action).
 */
export const approveRequest = auditedMutation({
  action: "access_request.approved",
  resourceType: "access_request",
  getResourceId: (args) => args.requestId,
  getMetadata: (args) => ({
    accessType: args.accessType,
    durationHours: args.durationHours,
  }),
  args: {
    requestId: v.id("access_requests"),
    accessType: v.union(v.literal("read"), v.literal("read_download")),
    durationHours: v.number(),
    sectionsApproved: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.vaultUserId !== userId) {
      throw new Error("Request not found");
    }
    if (request.status !== "pending") {
      throw new Error("Request is no longer pending");
    }

    const now = Date.now();
    const expiresAt = now + args.durationHours * 60 * 60 * 1000;

    await ctx.db.patch(args.requestId, {
      status: "approved",
      respondedAt: now,
      accessType: args.accessType,
      accessExpiresAt: expiresAt,
      sectionsRequested: args.sectionsApproved,
      updatedAt: now,
    });

    const contact = await ctx.db.get(request.requestedBy);
    if (contact?.contactUserId) {
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "access_request",
        title: "Access approved",
        body: `Your access request has been approved for ${args.durationHours} hours.`,
        actionUrl: "/trusted-contacts",
        channels: ["push", "email"],
        relatedId: args.requestId,
        relatedType: "access_request",
      });
    }

    return { success: true };
  },
});

/**
 * Deny an access request.
 */
export const denyRequest = auditedMutation({
  action: "access_request.denied",
  resourceType: "access_request",
  getResourceId: (args) => args.requestId,
  args: {
    requestId: v.id("access_requests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.vaultUserId !== userId) {
      throw new Error("Request not found");
    }
    if (request.status !== "pending") {
      throw new Error("Request is no longer pending");
    }

    const now = Date.now();

    await ctx.db.patch(args.requestId, {
      status: "denied",
      respondedAt: now,
      updatedAt: now,
    });

    const contact = await ctx.db.get(request.requestedBy);
    if (contact?.contactUserId) {
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "access_request",
        title: "Access denied",
        body: args.reason
          ? `Your access request was denied: ${args.reason}`
          : "Your access request was denied.",
        actionUrl: "/trusted-contacts",
        relatedId: args.requestId,
        relatedType: "access_request",
      });
    }

    return { success: true };
  },
});

/**
 * Initiate Mode A (post-mortem) access.
 */
export const initiateEmergencyAccess = auditedMutation({
  action: "access_request.emergency_initiated",
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
    if (!contact.accessModes.includes("mode_a")) {
      throw new Error("You do not have emergency access permission");
    }

    const now = Date.now();

    const existingModeA = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", contact.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("accessMode"), "mode_a"),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "approved")
          )
        )
      )
      .first();

    if (existingModeA) {
      const contactsInitiated = existingModeA.contactsInitiated ?? [];
      if (contactsInitiated.includes(args.contactId)) {
        throw new Error("You have already initiated emergency access");
      }

      const updatedContacts = [...contactsInitiated, args.contactId];
      const quorumReached = updatedContacts.length >= 2;

      await ctx.db.patch(existingModeA._id, {
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
          body: "Two or more contacts have initiated emergency access. You have 72 hours to cancel.",
          actionUrl: "/trusted-contacts",
          channels: ["push", "email"],
          relatedId: existingModeA._id,
          relatedType: "access_request",
        });
      }

      return { requestId: existingModeA._id, quorumReached };
    }

    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: contact.userId,
      requestedBy: args.contactId,
      accessMode: "mode_a",
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
 * Cancel emergency access during grace period (vault owner action).
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
    if (request.accessMode !== "mode_a") {
      throw new Error("Only Mode A requests can be cancelled this way");
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
