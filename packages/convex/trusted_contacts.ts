import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createNotification,
  requireAuth,
  resolveItemRecipients,
} from "./helpers";
import { auditedMutation } from "./audit";
import { normalizeE164 } from "./lib/phone";
import { isValidEmail, normalizeEmail } from "./lib/email";
import { requireEnv } from "./lib/require_env";

const MAX_TRUST_CONTACTS = 5;

/**
 * Minimum trust contacts required before recovery shards can be distributed.
 * A single guardian is useless for continuity: the unreachability quorum needs
 * ≥2 votes, and a lone contact has no peer to exchange shards with, so Shamir
 * reconstruction can never reach 2 shares. Exported so the Hub can reflect the
 * same floor in its continuity score.
 */
export const MIN_TRUST_CONTACTS_FOR_RECOVERY = 2;

const contactTypeValidator = v.union(
  v.literal("trust"),
  v.literal("recipient_only"),
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
 * Summarise what a single contact is routed to receive, for the contact
 * detail view. NOT standing vault access — a contact never reads vault data.
 * It lists the vault items that would be released to them on trigger (computed
 * with the exact same precedence used at release time, via
 * `resolveItemRecipients`, so the view can never drift from real behaviour)
 * plus the recipient groups they belong to. Recovery/shard state already
 * lives on the contact doc, so it is not re-fetched here.
 */
export const getContactAccessSummary = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const releasedItems = [];
    for (const item of items) {
      const recipients = await resolveItemRecipients(ctx, item, userId);
      if (recipients.includes(args.contactId)) {
        releasedItems.push({
          _id: item._id,
          title: item.title,
          category: item.category,
          recipientMode: item.recipientMode ?? "default",
          isReleaseIntroduction: item.isReleaseIntroduction === true,
        });
      }
    }
    // Welcome messages (release introductions) always render at the top of
    // the contact's item list — they're meant to greet the contact before
    // they read anything else, so they shouldn't get buried under categorized
    // items. Stable secondary order = insertion (vault item by_user index).
    releasedItems.sort(
      (a, b) => Number(b.isReleaseIntroduction) - Number(a.isReleaseIntroduction),
    );

    const groups = await ctx.db
      .query("recipient_groups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const memberGroups = groups
      .filter((g) => g.memberContactIds.includes(args.contactId))
      .map((g) => ({ _id: g._id, name: g.name }));

    return { releasedItems, memberGroups };
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
export const inviteContact = auditedMutation({
  action: "trusted_contact.invited",
  resourceType: "trusted_contact",
  getResourceId: (_args, result) => (result as { contactId: string }).contactId,
  getMetadata: (args) => ({
    email: args.email,
    role: args.role,
    contactType: args.contactType ?? "trust",
  }),
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: v.union(
      v.literal("family"),
      v.literal("friend"),
      v.literal("lawyer"),
      v.literal("doctor"),
      v.literal("other"),
    ),
    contactType: v.optional(contactTypeValidator),
    introMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const contactType = args.contactType ?? "trust";
    const introMessage = args.introMessage?.trim() || undefined;

    // A contact is reachable by email, phone, or both — but at least one
    // identifier is required. `normalizeE164` also validates the phone format.
    const email = args.email?.trim() ? normalizeEmail(args.email) : undefined;
    const phoneNumber = normalizeE164(args.phoneNumber);
    if (!email && !phoneNumber) {
      throw new Error("Add an email or a phone number");
    }
    if (email && !isValidEmail(email)) {
      throw new Error("Please enter a valid email");
    }

    const existing = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();

    if (contactType === "trust") {
      const trustCount = existing.filter(
        (c) => (c.contactType ?? "trust") === "trust",
      ).length;
      if (trustCount >= MAX_TRUST_CONTACTS) {
        throw new Error("Maximum of 5 trusted contacts reached");
      }
    }

    // Dedup on whichever identifier(s) the invite carries.
    if (email && existing.some((c) => c.email?.toLowerCase() === email)) {
      throw new Error("A contact with this email already exists");
    }
    if (
      phoneNumber &&
      existing.some((c) => normalizeE164(c.phoneNumber) === phoneNumber)
    ) {
      throw new Error("A contact with this phone number already exists");
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
      email,
      phoneNumber,
      role: args.role,
      contactType,
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
          .filter((i): i is number => typeof i === "number"),
      );
      let shardIndex = 2;
      while (usedIndices.has(shardIndex) && shardIndex <= 4) {
        shardIndex++;
      }

      contactId = await ctx.db.insert("trusted_contacts", {
        ...baseFields,
        shardIndex,
        encryptedShard: "",
        shardPublicKeyUsed: "",
        shardConfirmed: false,
      });
    } else {
      contactId = await ctx.db.insert("trusted_contacts", baseFields);
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

    // Email is the acceptance-link channel for trust contacts, and the
    // courtesy-intro channel for recipient-only contacts who opted in — only
    // possible when an email is on file (phone-only contacts skip it).
    const shouldEmail =
      !!email &&
      (contactType === "trust" ||
        (contactType === "recipient_only" && !!introMessage));
    if (shouldEmail) {
      await ctx.scheduler.runAfter(
        0,
        internal.trusted_contacts.sendInvitationEmail,
        { contactId },
      );
    }

    // Additive WhatsApp nudge for trust contacts who provided a phone number.
    // Email remains the canonical channel (carries the same accept link).
    if (contactType === "trust" && baseFields.phoneNumber) {
      const inviter = await ctx.db.get(userId);
      await ctx.scheduler.runAfter(
        0,
        internal.dispatch.sendInvitationWhatsApp,
        {
          phoneNumber: baseFields.phoneNumber,
          inviterName: inviter?.name?.trim() || "A Keeplas user",
          invitationToken,
        },
      );
    }

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
        q.eq("invitationToken", args.token),
      )
      .first();

    if (!contact) return null;

    // Get inviter info
    const inviter = await ctx.db.get(contact.userId);

    return {
      _id: contact._id,
      name: contact.name,
      email: contact.email ?? null,
      phoneNumber: contact.phoneNumber ?? null,
      role: contact.role,
      invitationStatus: contact.invitationStatus,
      invitedAt: contact.invitedAt,
      inviterName: resolveInviterName(inviter),
      inviterEmail: inviter?.email ?? null,
    };
  },
});

function resolveInviterName(
  inviter: { name?: string; email?: string } | null,
): string {
  const name = inviter?.name?.trim();
  if (name) return name;
  const localPart = inviter?.email?.split("@")[0]?.trim();
  if (localPart) return localPart;
  return "A Keeplas user";
}

/**
 * Accept an invitation (called by the invited contact after they create an account).
 */
export const acceptInvitation = auditedMutation({
  action: "trusted_contact.accepted",
  resourceType: "trusted_contact",
  args: {
    token: v.string(),
    contactPublicKey: v.optional(v.string()),
  },
  resolveActor: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);
    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token),
      )
      .first();
    if (!contact) throw new Error("Invalid invitation token");
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: contactUserId,
    };
  },
  getResourceId: (_args, result) =>
    (result as { contactRecordId: string }).contactRecordId,
  handler: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);

    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token),
      )
      .first();

    if (!contact) throw new Error("Invalid invitation token");
    if (contact.invitationStatus !== "pending") {
      throw new Error("This invitation has already been processed");
    }

    const expiresAt = contact.invitedAt + 72 * 60 * 60 * 1000;
    if (Date.now() > expiresAt) {
      throw new Error("This invitation has expired");
    }

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

    // Backfill the contact's other identifier onto their user record. The
    // invite holds both email and phone, but signup only persists the one the
    // contact signed in with (e.g. phone signup drops the invited email). We
    // copy any missing identifier so it is on file. It is stored UNVERIFIED —
    // no `emailVerificationTime` / `phoneNumberVerifiedAt` and no auth account
    // — so it is contact info only, never a login method until the contact
    // proves ownership themselves. Skipped if it would collide with another
    // user's identifier.
    const user = await ctx.db.get(contactUserId);
    const invitedEmail = contact.email?.trim().toLowerCase() || undefined;
    const invitedPhone = normalizeE164(contact.phoneNumber);
    const backfill: { email?: string; phoneNumber?: string } = {};

    if (user && !user.email && invitedEmail) {
      const clash = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", invitedEmail))
        .first();
      if (!clash) backfill.email = invitedEmail;
    }
    if (user && !user.phoneNumber && invitedPhone) {
      const clash = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", invitedPhone))
        .first();
      if (!clash) backfill.phoneNumber = invitedPhone;
    }
    if (Object.keys(backfill).length > 0) {
      await ctx.db.patch(contactUserId, { ...backfill, updatedAt: now });
    }

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

    return { success: true, contactRecordId: contact._id };
  },
});

/**
 * Decline an invitation.
 */
export const declineInvitation = auditedMutation({
  action: "trusted_contact.declined",
  resourceType: "trusted_contact",
  args: { token: v.string() },
  resolveActor: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);
    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token),
      )
      .first();
    if (!contact) throw new Error("Invalid invitation token");
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: contactUserId,
    };
  },
  getResourceId: (_args, result) =>
    (result as { contactRecordId: string }).contactRecordId,
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const contact = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.token),
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

    return { success: true, contactRecordId: contact._id };
  },
});

/**
 * Store an encrypted shard for a contact (called by the vault owner after
 * contact accepts). Sends an in-app notification to the contact on the
 * first distribution; subsequent re-distributions (e.g., threshold change)
 * are silent — the contact's /shared-with-me page picks up the new envelope
 * automatically via useReceiveShard.
 */
export const storeEncryptedShard = auditedMutation({
  action: "trusted_contact.shard_distributed",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
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

    // Refuse to seal a shard while the trusted circle is below the recovery
    // floor — a lone guardian creates a broken-but-silent setup (no peer to
    // exchange shards with, quorum unreachable). Authoritative across every
    // distribution path.
    const acceptedTrustCount = (
      await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
        .collect()
    ).filter((c) => (c.contactType ?? "trust") === "trust").length;
    if (acceptedTrustCount < MIN_TRUST_CONTACTS_FOR_RECOVERY) {
      throw new Error(
        "Recovery needs at least 2 trusted contacts before shards can be distributed.",
      );
    }

    const isFirstDistribution = !contact.shardConfirmed;

    await ctx.db.patch(args.contactId, {
      encryptedShard: args.encryptedShard,
      shardPublicKeyUsed: args.shardPublicKeyUsed,
      shardConfirmed: true,
      shardConfirmedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (isFirstDistribution && contact.contactUserId) {
      const owner = await ctx.db.get(userId);
      const ownerName = owner?.name?.trim() || "A Keeplas user";
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "vault_update",
        title: "You now safeguard a recovery shard",
        body: `${ownerName} has distributed your encrypted recovery shard. It will be used together with the other trust contacts' shards if their vault ever needs to be reconstructed.`,
        actionUrl: "/shared-with-me",
        channels: ["push", "email"],
        relatedId: contact._id,
        relatedType: "trusted_contact",
      });
    }

    return { success: true };
  },
});

/**
 * Stamp `lastVerifiedAt` after the contact successfully unwrapped their
 * encrypted shard on their device (see useReceiveShard) — a fresh unwrap is
 * the liveness proof. Called by the contact, not the vault owner, so the
 * audit entry lives on the owner's chain.
 */
export const confirmShardVerified = auditedMutation({
  action: "trusted_contact.shard_verified",
  resourceType: "trusted_contact",
  args: { contactId: v.id("trusted_contacts") },
  resolveActor: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.contactUserId !== contactUserId) {
      throw new Error("Contact not found");
    }
    return {
      chainUserId: contact.userId,
      actorType: "trusted_contact",
      actorId: contactUserId,
    };
  },
  getResourceId: (args) => args.contactId,
  handler: async (ctx, args) => {
    const contactUserId = await requireAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== contactUserId) {
      throw new Error("Contact not found");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new Error("Access has been revoked");
    }
    // Verification proves the contact can unwrap their shard — it is
    // meaningless before one has been distributed. Enforce at the boundary so
    // the badge can never light up without a real fragment in custody.
    if (!contact.shardConfirmed) {
      throw new Error("No shard distributed to verify");
    }

    await ctx.db.patch(args.contactId, {
      lastVerifiedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Revoke a trusted contact.
 */
export const revokeContact = auditedMutation({
  action: "trusted_contact.revoked",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
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

    return { success: true };
  },
});

/**
 * Resend invitation to a pending contact.
 */
export const resendInvitation = auditedMutation({
  action: "trusted_contact.invitation_resent",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
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

    // Re-deliver on whichever channel the contact has on file. Email carries
    // the accept link; for trust contacts with a phone, WhatsApp does too —
    // and is the only channel for phone-only contacts.
    if (contact.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.trusted_contacts.sendInvitationEmail,
        { contactId: args.contactId },
      );
    }
    if ((contact.contactType ?? "trust") === "trust" && contact.phoneNumber) {
      const inviter = await ctx.db.get(userId);
      await ctx.scheduler.runAfter(
        0,
        internal.dispatch.sendInvitationWhatsApp,
        {
          phoneNumber: contact.phoneNumber,
          inviterName: inviter?.name?.trim() || "A Keeplas user",
          invitationToken,
        },
      );
    }

    return { invitationToken };
  },
});

/**
 * Replace the user's keeplas-side shard. Used during shard redistribution
 * (when the vault threshold changes, or when shards are first distributed
 * to a freshly-invited contact and the master key has to be re-split).
 */
export const updateKeeplasShard = auditedMutation({
  action: "user.keeplas_shard_updated",
  resourceType: "user",
  getResourceId: () => "self",
  args: { keeplasShard: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await ctx.db.patch(userId, {
      keeplasShard: args.keeplasShard,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Get all accepted trust contacts of the calling user with their public
 * keys — used by the Distribute Shards flow to know who to wrap shards for.
 */
export const getDistributionTargets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    return contacts
      .filter((c) => (c.contactType ?? "trust") === "trust")
      .filter(
        (c) =>
          typeof c.shardIndex === "number" &&
          typeof c.contactPublicKey === "string",
      )
      .map((c) => ({
        contactId: c._id,
        name: c.name,
        shardIndex: c.shardIndex as number,
        contactPublicKey: c.contactPublicKey as string,
        shardConfirmed: c.shardConfirmed ?? false,
      }));
  },
});

/**
 * Re-publish the calling user's ML-KEM public key on every trusted_contacts
 * row where they are the contact (contactUserId === me). Used to backfill
 * rows accepted before the contact's crypto was ready, so the vault owner
 * can later wrap a verification envelope to them.
 *
 * Only patches rows whose contactPublicKey is missing or different from the
 * provided value — idempotent and safe to call repeatedly.
 */
export const republishContactPublicKey = auditedMutation({
  action: "trusted_contact.public_key_republished",
  resourceType: "trusted_contact",
  getResourceId: () => "self",
  args: { contactPublicKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    let patched = 0;
    for (const row of rows) {
      if (row.contactPublicKey === args.contactPublicKey) continue;
      await ctx.db.patch(row._id, {
        contactPublicKey: args.contactPublicKey,
        updatedAt: Date.now(),
      });
      patched++;
    }
    return { patched };
  },
});

/**
 * Get contacts where the current user is the invited contact (for contact's hub).
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

    // Enrich with vault owner info + most recent active life-check cycle
    // status, so the contact UI can gate "Mark as unreachable" on escalation.
    const result = [];
    for (const contact of contacts) {
      const owner = await ctx.db.get(contact.userId);

      const activeCycle = await ctx.db
        .query("life_check_cycles")
        .withIndex("by_user", (q) => q.eq("userId", contact.userId))
        .order("desc")
        .first();

      // Whether the owner's vault has been released to this contact — drives
      // the "View memorial vault" entry point. Use the PER-RECIPIENT release row
      // (carries `item:` sections), not the recovery-quorum `["all"]` sentinel a
      // confirming contact also holds, so the count and gate reflect the bequest.
      const approvedReqs = await ctx.db
        .query("access_requests")
        .withIndex("by_requester", (q) => q.eq("requestedBy", contact._id))
        .filter((q) => q.eq(q.field("status"), "approved"))
        .collect();
      const releaseReq = approvedReqs.find((r) =>
        r.sectionsRequested.some((s) => s.startsWith("item:")),
      );
      const releasedItemCount = releaseReq
        ? releaseReq.sectionsRequested.filter((s) => s.startsWith("item:"))
            .length
        : 0;

      const trimmedName = owner?.name?.trim() || "";
      const email = owner?.email ?? "";
      const localPart = email.split("@")[0] ?? "";
      const displayName = trimmedName || localPart || "Keeplas user";

      result.push({
        ...contact,
        ownerName: displayName,
        ownerEmail: email,
        ownerCycleStatus: activeCycle?.status ?? null,
        ownerCycleEscalatedAt: activeCycle?.levelReachedAt ?? null,
        released: !!releaseReq,
        releasedItemCount,
      });
    }
    return result;
  },
});

/**
 * Send the invitation email to a freshly invited (or re-invited) contact.
 * Trust contacts receive an acceptance link; recipient-only contacts that
 * opted into the courtesy intro receive the inviter's intro message.
 *
 * No-ops gracefully when Resend credentials are missing so dev environments
 * without external integrations still work.
 */
export const sendInvitationEmail = internalAction({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return "resend_not_configured";

    const data = await ctx.runQuery(
      internal.trusted_contacts.getInvitationEmailContext,
      { contactId: args.contactId },
    );
    if (!data) return "contact_not_found";
    if (data.invitationStatus !== "pending") return "not_pending";
    if (!data.email) return "no_email";

    const from = requireEnv("RESEND_FROM_EMAIL");
    const appUrl = requireEnv("APP_URL");
    const acceptUrl = `${appUrl}/invite/${data.invitationToken}`;
    const inviterName = data.inviterName?.trim() || "A Keeplas user";

    const isTrust = (data.contactType ?? "trust") === "trust";
    const subject = isTrust
      ? `${inviterName} invited you as a trusted contact on Keeplas`
      : `${inviterName} added you as a recipient on Keeplas`;

    const html = isTrust
      ? trustInvitationHtml({
          appUrl,
          recipientName: data.name,
          inviterName,
          acceptUrl,
        })
      : recipientIntroHtml({
          appUrl,
          recipientName: data.name,
          inviterName,
          introMessage: data.introMessage ?? "",
        });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`resend ${res.status}: ${text.slice(0, 160)}`);
    }
    return "sent";
  },
});

/**
 * Internal-only data fetch used by `sendInvitationEmail`. Returns the
 * minimal shape needed to render the invitation email.
 */
export const getInvitationEmailContext = internalQuery({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;
    const inviter = await ctx.db.get(contact.userId);
    return {
      name: contact.name,
      email: contact.email,
      contactType: contact.contactType,
      invitationStatus: contact.invitationStatus,
      invitationToken: contact.invitationToken,
      introMessage: contact.introMessage,
      inviterName: inviter?.name ?? null,
    };
  },
});

function trustInvitationHtml(opts: {
  appUrl: string;
  recipientName: string;
  inviterName: string;
  acceptUrl: string;
}) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:520px;margin:auto;padding:24px">
<p style="text-align:center;margin:0 0 24px"><img src="${opts.appUrl}/assets/logo/logo-wordmark.svg" alt="Keeplas" width="200" height="40" style="display:inline-block;border:0;outline:none;text-decoration:none"/></p>
<p>Hi ${escapeHtml(opts.recipientName)},</p>
<p><strong>${escapeHtml(opts.inviterName)}</strong> has chosen you as a trusted contact on Keeplas, the zero-knowledge life-continuity platform.</p>
<p>As a trusted contact, you'll hold one encrypted shard of their recovery key — together with their other contacts you can help them regain access to their vault if they ever lose their credentials. You won't see any of their data.</p>
<p style="margin:32px 0;text-align:center"><a href="${opts.acceptUrl}" style="display:inline-block;padding:12px 28px;background:#041632;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Accept invitation</a></p>
<p style="color:#666;font-size:13px">This link expires in 72 hours. If the button doesn't work, open this URL in your browser:<br/><a href="${opts.acceptUrl}" style="color:#041632;word-break:break-all">${opts.acceptUrl}</a></p>
<p style="color:#666;font-size:13px;margin-top:24px">If you weren't expecting this invitation, you can ignore this email.</p>
</body></html>`;
}

function recipientIntroHtml(opts: {
  appUrl: string;
  recipientName: string;
  inviterName: string;
  introMessage: string;
}) {
  const message = opts.introMessage
    ? `<div style="white-space:pre-wrap;background:#f6f6f6;border-radius:10px;padding:16px;margin:24px 0">${escapeHtml(opts.introMessage)}</div>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:520px;margin:auto;padding:24px">
<p style="text-align:center;margin:0 0 24px"><img src="${opts.appUrl}/assets/logo/logo-wordmark.svg" alt="Keeplas" width="200" height="40" style="display:inline-block;border:0;outline:none;text-decoration:none"/></p>
<p>Hi ${escapeHtml(opts.recipientName)},</p>
<p><strong>${escapeHtml(opts.inviterName)}</strong> added you as a recipient on Keeplas. You don't need to do anything right now — Keeplas will only contact you if a specific event they have set up is triggered.</p>
${message}
<p style="color:#666;font-size:13px;margin-top:24px">If this email reached you by mistake, you can ignore it.</p>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}

const RECONFIRM_STALE_MS = 30 * 24 * 60 * 60 * 1000; // verification considered stale
const RECONFIRM_THROTTLE_MS = 6 * 24 * 60 * 60 * 1000; // ≤ 1 nudge / weekly run
const MAX_RECONFIRM_REMINDERS = 3; // then alert the owner to replace
const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000; // matches the accept-link TTL

/**
 * Weekly availability re-confirmation sweep (driven by crons.ts). Two gaps
 * it closes:
 *
 *  - An accepted trust contact whose shard verification is missing or older
 *    than 30 days gets nudged (in-app + email, plus WhatsApp when a phone is
 *    on file) to re-verify. After 3 ignored nudges the vault owner is alerted
 *    once to replace the unresponsive contact.
 *  - A trust invitation still "pending" past its 72h accept window alerts the
 *    owner once that the contact never came on board.
 *
 * Reuses the existing notification + WhatsApp dispatch infrastructure; no
 * new messaging system. Idempotent via `ownerNotifiedUnavailableAt`.
 */
export const runAvailabilityReconfirm = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const contacts = await ctx.db.query("trusted_contacts").collect();

    for (const c of contacts) {
      if ((c.contactType ?? "trust") !== "trust") continue;
      if (
        c.invitationStatus === "revoked" ||
        c.invitationStatus === "declined"
      ) {
        continue;
      }

      // Gap 2: invitation never accepted within the accept window.
      if (
        c.invitationStatus === "pending" &&
        now - c.invitedAt > INVITE_EXPIRY_MS
      ) {
        if (!c.ownerNotifiedUnavailableAt) {
          await createNotification(ctx, {
            userId: c.userId,
            type: "security_alert",
            title: "Trusted contact unavailable",
            body: `${c.name} never accepted your invitation. Replace them so your continuity protocol stays operational.`,
            channels: ["push", "email"],
            actionUrl: "/trusted-contacts",
            relatedId: c._id,
            relatedType: "trusted_contact",
          });
          await ctx.db.patch(c._id, {
            ownerNotifiedUnavailableAt: now,
            updatedAt: now,
          });
        }
        continue;
      }

      // Gap 1: accepted but shard verification missing/stale.
      const verificationStale =
        c.lastVerifiedAt === undefined ||
        now - c.lastVerifiedAt > RECONFIRM_STALE_MS;
      if (
        c.invitationStatus !== "accepted" ||
        !c.contactUserId ||
        !verificationStale
      ) {
        continue;
      }

      const throttled =
        c.lastReconfirmAt !== undefined &&
        now - c.lastReconfirmAt < RECONFIRM_THROTTLE_MS;
      if (throttled) continue;

      const owner = await ctx.db.get(c.userId);
      const ownerName = owner?.name?.trim() || "a Keeplas user";

      await createNotification(ctx, {
        userId: c.contactUserId,
        type: "vault_update",
        title: "Can you still safeguard their recovery shard?",
        body: `Please re-verify that you can still access ${ownerName}'s recovery shard on Keeplas so their continuity protection stays active.`,
        channels: ["push", "email"],
        actionUrl: "/shared-with-me",
        relatedId: c._id,
        relatedType: "trusted_contact",
      });

      if (c.phoneNumber) {
        await ctx.scheduler.runAfter(
          0,
          internal.dispatch.sendReconfirmWhatsApp,
          { phoneNumber: c.phoneNumber, ownerName },
        );
      }

      const reminders = (c.reconfirmReminders ?? 0) + 1;
      await ctx.db.patch(c._id, {
        reconfirmReminders: reminders,
        lastReconfirmAt: now,
        updatedAt: now,
      });

      if (
        reminders >= MAX_RECONFIRM_REMINDERS &&
        !c.ownerNotifiedUnavailableAt
      ) {
        await createNotification(ctx, {
          userId: c.userId,
          type: "security_alert",
          title: "Trusted contact unresponsive",
          body: `${c.name} hasn't re-verified their recovery shard after several reminders. Replace them so your continuity protocol stays operational.`,
          channels: ["push", "email"],
          actionUrl: "/trusted-contacts",
          relatedId: c._id,
          relatedType: "trusted_contact",
        });
        await ctx.db.patch(c._id, {
          ownerNotifiedUnavailableAt: now,
          updatedAt: now,
        });
      }
    }
  },
});
