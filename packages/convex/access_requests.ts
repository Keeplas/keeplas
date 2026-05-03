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
