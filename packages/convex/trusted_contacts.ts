import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createNotification, requireAuth } from "./helpers";
import { createAuditLog } from "./audit";

const MAX_TRUST_CONTACTS = 5;

const contactTypeValidator = v.union(
  v.literal("trust"),
  v.literal("recipient_only")
);

/**
 * Get all trusted contacts for the authenticated user.
 */
export const getContacts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
  },
});

/**
 * Get a single contact by ID.
 */
export const getContact = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    return contact;
  },
});

/**
 * Get contact count (non-revoked) for the authenticated user.
 */
export const getContactCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
    return contacts.length;
  },
});

/**
 * Invite a new contact. Pass contactType="recipient_only" to skip the
 * social-recovery role (no shard, no 5-cap).
 */
export const inviteContact = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    role: v.union(
      v.literal("family"),
      v.literal("friend"),
      v.literal("lawyer"),
      v.literal("doctor"),
      v.literal("other")
    ),
    contactType: v.optional(contactTypeValidator),
    introMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const contactType = args.contactType ?? "trust";
    const introMessage = args.introMessage?.trim() || undefined;

    const existing = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();

    if (contactType === "trust") {
      const trustCount = existing.filter(
        (c) => (c.contactType ?? "trust") === "trust"
      ).length;
      if (trustCount >= MAX_TRUST_CONTACTS) {
        throw new Error("Maximum of 5 trusted contacts reached");
      }
    }

    const duplicate = existing.find(
      (c) => c.email.toLowerCase() === args.email.toLowerCase()
    );
    if (duplicate) {
      throw new Error("A contact with this email already exists");
    }

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const invitationToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const now = Date.now();

    const baseFields = {
      userId,
      name: args.name,
      email: args.email,
      phoneNumber: args.phoneNumber,
      role: args.role,
      contactType,
      isFirstResponder: false,
      isMedicalContact: false,
      invitationStatus: "pending" as const,
      invitationToken,
      invitedAt: now,
      introMessage,
      createdAt: now,
      updatedAt: now,
    };

    let contactId;
    if (contactType === "trust") {
      const usedIndices = new Set(
        existing
          .filter((c) => (c.contactType ?? "trust") === "trust")
          .map((c) => c.shardIndex)
          .filter((i): i is number => typeof i === "number")
      );
      let shardIndex = 2;
      while (usedIndices.has(shardIndex) && shardIndex <= 4) {
        shardIndex++;
      }

      contactId = await ctx.db.insert("trusted_contacts", {
        ...baseFields,
        accessModes: ["mode_a"],
        shardIndex,
        encryptedShard: "",
        shardPublicKeyUsed: "",
        shardConfirmed: false,
      });
    } else {
      contactId = await ctx.db.insert("trusted_contacts", {
        ...baseFields,
        accessModes: [],
      });
    }

    await createNotification(ctx, {
      userId,
      type: "contact_invited",
      title: "Invitation sent",
      body:
        contactType === "trust"
          ? `You invited ${args.name} as a trusted contact.`
          : `You invited ${args.name} as a recipient.`,
      actionUrl: "/trusted-contacts",
      relatedId: contactId,
      relatedType: "trusted_contact",
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "contact_invited",
      resourceType: "trusted_contact",
      resourceId: contactId,
      metadata: JSON.stringify({
        email: args.email,
        role: args.role,
        contactType,
      }),
    });

    return { contactId, invitationToken };
  },
});

/**
 * Get a contact invitation by token (public - no auth required).
 */
export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token)
      )
      .first();

    if (!contact) return null;

    // Get inviter info
    const inviter = await ctx.db.get(contact.userId);

    return {
      _id: contact._id,
      name: contact.name,
      role: contact.role,
      invitationStatus: contact.invitationStatus,
      invitedAt: contact.invitedAt,
      inviterName: inviter?.name ?? "Unknown",
    };
  },
});

/**
 * Accept an invitation (called by the invited contact after they create an account).
 */
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
    contactPublicKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);

    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token)
      )
      .first();

    if (!contact) throw new Error("Invalid invitation token");
    if (contact.invitationStatus !== "pending") {
      throw new Error("This invitation has already been processed");
    }

    // Check token is not expired (72h)
    const expiresAt = contact.invitedAt + 72 * 60 * 60 * 1000;
    if (Date.now() > expiresAt) {
      throw new Error("This invitation has expired");
    }

    // Prevent self-invitation
    if (contact.userId === contactUserId) {
      throw new Error("You cannot accept your own invitation");
    }

    const now = Date.now();

    await ctx.db.patch(contact._id, {
      contactUserId,
      invitationStatus: "accepted",
      acceptedAt: now,
      contactPublicKey: args.contactPublicKey,
      updatedAt: now,
    });

    // Notify the vault owner
    await createNotification(ctx, {
      userId: contact.userId,
      type: "contact_confirmed",
      title: "Contact accepted",
      body: `${contact.name} accepted your invitation and is now a trusted contact.`,
      actionUrl: "/trusted-contacts",
      channels: ["push", "email"],
      relatedId: contact._id,
      relatedType: "trusted_contact",
    });

    await createAuditLog(ctx, {
      userId: contact.userId,
      actorType: "trusted_contact",
      actorId: contactUserId,
      action: "contact_accepted",
      resourceType: "trusted_contact",
      resourceId: contact._id,
    });

    return { success: true };
  },
});

/**
 * Decline an invitation.
 */
export const declineInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);

    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token)
      )
      .first();

    if (!contact) throw new Error("Invalid invitation token");
    if (contact.invitationStatus !== "pending") {
      throw new Error("This invitation has already been processed");
    }

    await ctx.db.patch(contact._id, {
      invitationStatus: "declined",
      updatedAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: contact.userId,
      type: "contact_invited",
      title: "Invitation declined",
      body: `${contact.name} declined your trusted contact invitation.`,
      actionUrl: "/trusted-contacts",
      relatedId: contact._id,
      relatedType: "trusted_contact",
    });

    return { success: true };
  },
});

/**
 * Store an encrypted shard for a contact (called by the vault owner after contact accepts).
 */
export const storeEncryptedShard = mutation({
  args: {
    contactId: v.id("trusted_contacts"),
    encryptedShard: v.string(),
    shardPublicKeyUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new Error("Contact must accept the invitation first");
    }

    await ctx.db.patch(args.contactId, {
      encryptedShard: args.encryptedShard,
      shardPublicKeyUsed: args.shardPublicKeyUsed,
      shardConfirmed: true,
      shardConfirmedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "shard_distributed",
      resourceType: "trusted_contact",
      resourceId: args.contactId,
    });

    return { success: true };
  },
});

/**
 * Toggle first responder designation.
 */
export const toggleFirstResponder = mutation({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    if (!contact.isFirstResponder) {
      // Unset any existing first responder
      const currentFirstResponder = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_first_responder", (q) =>
          q.eq("userId", userId).eq("isFirstResponder", true)
        )
        .first();

      if (currentFirstResponder) {
        await ctx.db.patch(currentFirstResponder._id, {
          isFirstResponder: false,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.contactId, {
      isFirstResponder: !contact.isFirstResponder,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle medical contact designation.
 */
export const toggleMedicalContact = mutation({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    await ctx.db.patch(args.contactId, {
      isMedicalContact: !contact.isMedicalContact,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle legal authority designation. Used by the scenario engine's
 * `alert_authority` action — only fires after a confirmed Life Check
 * failure. Multiple legal authorities are allowed (no singleton).
 */
export const toggleLegalAuthority = mutation({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    await ctx.db.patch(args.contactId, {
      isLegalAuthority: !(contact.isLegalAuthority ?? false),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update access modes for a contact.
 */
export const updateAccessModes = mutation({
  args: {
    contactId: v.id("trusted_contacts"),
    accessModes: v.array(
      v.union(
        v.literal("mode_a"),
        v.literal("mode_b1"),
        v.literal("mode_b2"),
        v.literal("mode_b3"),
        v.literal("mode_b4")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    await ctx.db.patch(args.contactId, {
      accessModes: args.accessModes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Revoke a trusted contact.
 */
export const revokeContact = mutation({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    if (contact.invitationStatus === "revoked") {
      throw new Error("Contact is already revoked");
    }

    await ctx.db.patch(args.contactId, {
      invitationStatus: "revoked",
      encryptedShard: "",
      shardConfirmed: false,
      isFirstResponder: false,
      isMedicalContact: false,
      isLegalAuthority: false,
      updatedAt: Date.now(),
    });

    // Notify the revoked contact if they had an account
    if (contact.contactUserId) {
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "security_alert",
        title: "Trusted contact access revoked",
        body: "Your trusted contact access has been revoked by the vault owner.",
        channels: ["push", "email"],
        relatedId: contact._id,
        relatedType: "trusted_contact",
      });
    }

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "contact_revoked",
      resourceType: "trusted_contact",
      resourceId: args.contactId,
      metadata: JSON.stringify({ contactName: contact.name }),
    });

    return { success: true };
  },
});

/**
 * Resend invitation to a pending contact.
 */
export const resendInvitation = mutation({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    if (contact.invitationStatus !== "pending") {
      throw new Error("Can only resend for pending invitations");
    }

    // Generate new token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const invitationToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await ctx.db.patch(args.contactId, {
      invitationToken,
      invitedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { invitationToken };
  },
});

/**
 * Get contacts where the current user is the invited contact (for contact's dashboard).
 */
export const getVaultsWhereIAmContact = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    // Enrich with vault owner info
    const result = [];
    for (const contact of contacts) {
      const owner = await ctx.db.get(contact.userId);
      result.push({
        ...contact,
        ownerName: owner?.name ?? "Unknown",
        ownerEmail: owner?.email ?? "",
      });
    }
    return result;
  },
});
