import { v, ConvexError } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createNotification, requireAuth, requireFullAuth } from "./helpers";
import { auditedMutation } from "./audit";
import { activePushTokens } from "./devices";

/**
 * Count the number of DISTINCT humans behind a set of trusted-contact rows.
 * Quorum (and any participation count) must dedup by `contactUserId`, never by
 * row id (C1): the same person invited via two channels gets two rows but must
 * count as a single vote. A row with no `contactUserId` (not yet accepted)
 * cannot have voted, so it is ignored.
 */
async function countDistinctContactPeople(
  ctx: MutationCtx,
  contactIds: Id<"trusted_contacts">[],
): Promise<number> {
  const people = new Set<string>();
  for (const contactId of contactIds) {
    const contact = await ctx.db.get(contactId);
    if (contact?.contactUserId) {
      people.add(contact.contactUserId);
    }
  }
  return people.size;
}

/**
 * Get pending access requests for the vault owner.
 */
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const requests = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", userId).eq("status", "pending"),
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
    const userId = await requireFullAuth(ctx);
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
    if (!contact) throw new ConvexError("Contact not found");
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: requesterId,
    };
  },
  getResourceId: (_args, result) => (result as { requestId: string }).requestId,
  handler: async (ctx, args) => {
    // Contact-side recovery op: step-up gated. By the time a contact confirms
    // unreachability the owner's Life Check has fully escalated, so the
    // contact is a long-established account whose login-OTP/TOTP gate is
    // reliably clearable.
    const requesterId = await requireFullAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== requesterId) {
      throw new ConvexError("Not authorized");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new ConvexError(
        "Contact must be accepted to confirm unreachability",
      );
    }

    // Gate: contacts may only confirm once the owner's Life Check has escalated
    // to the confirmation stage (it went unanswered through every check-in).
    const cycle = await ctx.db
      .query("life_check_cycles")
      .withIndex("by_status", (q) =>
        q.eq("userId", contact.userId).eq("status", "awaiting_confirmation"),
      )
      .first();
    if (!cycle) {
      throw new ConvexError(
        "This vault owner's Life Check has not requested contact confirmation.",
      );
    }

    const ownerConfig = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", contact.userId))
      .first();
    const threshold = ownerConfig?.confirmationThreshold ?? 2;
    const GRACE_MS = 72 * 60 * 60 * 1000;
    const now = Date.now();

    // When the threshold is first reached, open the owner-cancel grace window
    // and schedule the release for its end.
    const onQuorumReached = async (requestId: Id<"access_requests">) => {
      await ctx.scheduler.runAfter(
        GRACE_MS,
        internal.life_check.releaseAfterConfirmation,
        { userId: contact.userId, requestId },
      );
      await createNotification(ctx, {
        userId: contact.userId,
        type: "security_alert",
        title: "Emergency access initiated",
        body: `${threshold} or more contacts have confirmed you are unreachable. You have 72 hours to cancel.`,
        actionUrl: "/life-check",
        channels: ["push", "email"],
        relatedId: requestId,
        relatedType: "access_request",
      });

      // Real outbound delivery (push + email + WhatsApp): the owner's last-chance
      // 72h cancel alert. This is the safety net the grace window exists for,
      // so it must actually leave the building (createNotification is a no-op).
      const owner = await ctx.db.get(contact.userId);
      await ctx.scheduler.runAfter(0, internal.dispatch.notifyGraceCancel, {
        email: owner?.email,
        phoneNumber: owner?.phoneNumber,
        ownerName: owner?.name,
        language: owner?.language,
        pushTokens: await activePushTokens(ctx, contact.userId),
      });
    };

    const existing = await ctx.db
      .query("access_requests")
      .withIndex("by_vault_user", (q) => q.eq("vaultUserId", contact.userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved"),
        ),
      )
      .first();

    if (existing) {
      const contactsInitiated = existing.contactsInitiated ?? [];
      // Per-row replay guard: a single contact row can vote at most once.
      if (contactsInitiated.includes(args.contactId)) {
        throw new ConvexError("You have already confirmed unreachability");
      }

      const updatedContacts = [...contactsInitiated, args.contactId];
      // C1: quorum is reached by DISTINCT HUMANS, not distinct rows. Two rows
      // backed by the same `contactUserId` (same person invited via two
      // channels) count as ONE vote — otherwise one person could reach the
      // unreachability quorum alone. Resolve every initiating row to its
      // person and count the unique set.
      const distinctPeople = await countDistinctContactPeople(
        ctx,
        updatedContacts,
      );
      const quorumReached = distinctPeople >= threshold;
      const newlyReached = quorumReached && !existing.quorumReached;

      await ctx.db.patch(existing._id, {
        contactsInitiated: updatedContacts,
        quorumRequired: threshold,
        quorumReached,
        gracePeriodEndsAt: newlyReached
          ? now + GRACE_MS
          : existing.gracePeriodEndsAt,
        updatedAt: now,
      });

      if (newlyReached) {
        await onQuorumReached(existing._id);
      }

      return { requestId: existing._id, quorumReached };
    }

    // First initiator is one distinct person by definition.
    const quorumReached = 1 >= threshold;
    const requestId = await ctx.db.insert("access_requests", {
      vaultUserId: contact.userId,
      requestedBy: args.contactId,
      sectionsRequested: ["all"],
      status: "pending",
      autoResponseAt: now + GRACE_MS,
      quorumRequired: threshold,
      quorumReached,
      gracePeriodEndsAt: quorumReached ? now + GRACE_MS : undefined,
      contactsInitiated: [args.contactId],
      createdAt: now,
      updatedAt: now,
    });

    if (quorumReached) {
      await onQuorumReached(requestId);
    }

    return { requestId, quorumReached };
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
    const userId = await requireFullAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request || request.vaultUserId !== userId) {
      throw new ConvexError("Request not found");
    }

    const now = Date.now();

    if (request.gracePeriodEndsAt && now > request.gracePeriodEndsAt) {
      throw new ConvexError("Grace period has expired");
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

/**
 * Owner returned AFTER a release already fired: revoke the granted access.
 *
 * Unlike `cancelEmergencyAccess` (which only works during the 72h grace, on
 * "pending" requests), this closes already-"approved" release requests — the
 * state `confirmAlive` never touches. It flips every approved request for the
 * owner's vault to "revoked", which immediately starves every contact-facing
 * read path (they all gate on
 * status === "approved": getVaultsWhereIAmContact, resolveApprovedRelease).
 *
 * NOTE (zero-knowledge): this severs FUTURE app access only. It cannot claw
 * back item content a contact already decrypted on their device during the
 * release window — that requires the client-side master-key rotation flow.
 */
export const revokeReleasedAccess = auditedMutation({
  action: "access_request.revoked_after_return",
  resourceType: "user",
  args: {},
  getMetadata: (_args, result) => result as Record<string, unknown>,
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const now = Date.now();

    const approved = await ctx.db
      .query("access_requests")
      .withIndex("by_status", (q) =>
        q.eq("vaultUserId", userId).eq("status", "approved"),
      )
      .collect();

    const affectedContactUsers = new Set<Id<"users">>();

    for (const req of approved) {
      await ctx.db.patch(req._id, {
        status: "revoked",
        respondedAt: now,
        updatedAt: now,
      });

      const contact = await ctx.db.get(req.requestedBy);
      if (contact?.contactUserId) {
        affectedContactUsers.add(contact.contactUserId);
      }
    }

    for (const contactUserId of affectedContactUsers) {
      await createNotification(ctx, {
        userId: contactUserId,
        type: "security_alert",
        title: "Vault access revoked",
        body: "The vault owner has returned and revoked the access that was released to you.",
        actionUrl: "/shared-with-me",
        channels: ["push", "email"],
        relatedType: "access_request",
      });
    }

    return {
      revokedCount: approved.length,
      contactsNotified: affectedContactUsers.size,
    };
  },
});
