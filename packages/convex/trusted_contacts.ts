import { v, ConvexError } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  createNotification,
  optionalAuth,
  requireAuth,
  requireFullAuth,
  resolveItemRecipients,
} from "./helpers";
import { auditedMutation, type ActorIdentity } from "./audit";
import { contactRoleValidator } from "./validators";
import { normalizeE164 } from "./lib/phone";
import { isValidEmail, normalizeEmail } from "./lib/email";
import { requireEnv } from "./lib/require_env";
import { isNotificationsPaused } from "./lib/pause";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { resolveLocale, type Locale } from "./lib/locale";
import {
  formatSenderIdentity,
  ownerDisplay,
  verifiedChannels,
} from "./lib/identity";
import { DEFAULT_CONFIRMATION_THRESHOLD } from "./life_check";
import { publishContactKeyToOwnerRows } from "./lib/contact_key";
import { trustContactsHealth } from "./recovery";

/**
 * Minimum trust contacts for a working continuity setup. A single guardian is
 * useless: the unreachability quorum needs ≥2 votes. Exported so the Hub can
 * reflect the same floor in its continuity score.
 */
export const MIN_TRUST_CONTACTS_FOR_RECOVERY = 2;

/**
 * Get all trusted contacts for the authenticated user.
 */
export const getContacts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    return await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
  },
});

/**
 * Contacts projected for list screens: no ML-KEM public key or ML-DSA
 * signature (several KB of base64 per contact). Flows that wrap a DEK to a
 * contact keep using `getContacts` for the full key material.
 */
export const getContactSummaries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
    return contacts.map((contact) => ({
      _id: contact._id,
      name: contact.name,
      email: contact.email,
      phoneNumber: contact.phoneNumber,
      invitationStatus: contact.invitationStatus,
    }));
  },
});

/** Accepted contacts of a user. Shared by the hub and `getContactsReady`. */
export async function acceptedContacts(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("trusted_contacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
    .collect();
}

/**
 * A contact is ready once it has accepted and published its public key.
 * The quorum needs ≥ MIN_TRUST_CONTACTS_FOR_RECOVERY ready contacts — a lone
 * guardian must not light the readiness signal green.
 */
export function hasReadyTrustQuorum(
  contacts: Doc<"trusted_contacts">[],
): boolean {
  const ready = contacts.filter((c) => typeof c.contactPublicKey === "string");
  return ready.length >= MIN_TRUST_CONTACTS_FOR_RECOVERY;
}

/**
 * Whether the recovery quorum is ready. Lightweight signal for the mobile
 * Home, which needs only this bit of the hub data.
 */
export const getContactsReady = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return false;
    const user = await ctx.db.get(userId);
    if (!user) return false;
    const health = await trustContactsHealth(ctx, user);
    return health.configured && !health.renewalRequired;
  },
});

/**
 * How many distinct people must confirm the owner can't be reached before
 * their vault is released, and how many accepted people could. Below the
 * threshold nothing can ever be released, so the owner is warned.
 */
export const getReleaseQuorum = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    // Distinct humans, like the quorum count in markUserUnreachable.
    const people = new Set(
      (await acceptedContacts(ctx, userId)).flatMap((c) =>
        c.contactUserId ? [c.contactUserId] : [],
      ),
    );
    return {
      required: config?.confirmationThreshold ?? DEFAULT_CONFIRMATION_THRESHOLD,
      available: people.size,
    };
  },
});

/**
 * Get a single contact by ID.
 */
export const getContact = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
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
 * plus the recipient groups they belong to. Invitation / availability state
 * already lives on the contact doc, so it is not re-fetched here.
 */
export const getContactAccessSummary = query({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
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
      if (item.status === "archived") continue;
      const recipients = await resolveItemRecipients(ctx, item, userId);
      if (recipients.includes(args.contactId)) {
        releasedItems.push({
          _id: item._id,
          title: item.title,
          encryptedTitle: item.encryptedTitle,
          ownerWrappedDek: item.ownerWrappedDek,
          encryptionType: item.encryptionType,
          category: item.category,
          encryptedMeta: item.encryptedMeta,
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
      (a, b) =>
        Number(b.isReleaseIntroduction) - Number(a.isReleaseIntroduction),
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
    const userId = await requireFullAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
    return contacts.length;
  },
});

/**
 * Invite a new trusted contact. Every contact holds the same role: a quorum
 * vote and, through shared folders, the content assigned to them. No cap.
 */
export const inviteContact = auditedMutation({
  action: "trusted_contact.invited",
  resourceType: "trusted_contact",
  getResourceId: (_args, result) => (result as { contactId: string }).contactId,
  getMetadata: (args) => ({
    email: args.email,
    role: args.role,
  }),
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: contactRoleValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const { email, phoneNumber } = await checkContactChannels(
      ctx,
      userId,
      args,
    );
    const invitationToken = newInvitationToken();
    const now = Date.now();

    const baseFields = {
      userId,
      name: args.name,
      email,
      phoneNumber,
      role: args.role,
      invitationStatus: "pending" as const,
      invitationToken,
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const contactId = await ctx.db.insert("trusted_contacts", baseFields);

    // Contacts are auto-added to the user's default group so vault items with
    // recipientMode="default" route to them out of the box. Silent skip when
    // the default group is missing (legacy user that escaped seeding): invite
    // must not fail because of group bookkeeping.
    const defaultGroup = await ctx.db
      .query("recipient_groups")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true),
      )
      .first();
    if (defaultGroup && !defaultGroup.memberContactIds.includes(contactId)) {
      await ctx.db.patch(defaultGroup._id, {
        memberContactIds: [...defaultGroup.memberContactIds, contactId],
        updatedAt: now,
      });
    }

    await createNotification(ctx, {
      userId,
      type: "contact_invited",
      title: "Invitation sent",
      body: `You invited ${args.name} as a trusted contact.`,
      actionUrl: "/trusted-contacts",
      relatedId: contactId,
      relatedType: "trusted_contact",
    });

    await deliverInvitation(ctx, userId, {
      contactId,
      email,
      phoneNumber,
      invitationToken,
    });

    return { contactId, invitationToken };
  },
});

/**
 * Edit a contact's name, email, phone and role. A pending invitation whose email or
 * phone changed is re-issued: the old link is invalidated (it may have gone to
 * the wrong person) and the new one is sent to the corrected channels. An
 * accepted contact stays bound to the account that accepted; the new channels
 * only change where notifications are delivered.
 */
export const updateContact = auditedMutation({
  action: "trusted_contact.updated",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
  args: {
    contactId: v.id("trusted_contacts"),
    name: v.string(),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: v.optional(contactRoleValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (
      !contact ||
      contact.userId !== userId ||
      contact.invitationStatus === "revoked"
    ) {
      throw new Error("Contact not found");
    }
    const name = args.name.trim();
    if (!name) throw new Error("Add a name");

    const { email, phoneNumber } = await checkContactChannels(
      ctx,
      userId,
      args,
      contact._id,
    );
    const now = Date.now();
    await ctx.db.patch(contact._id, {
      name,
      email,
      phoneNumber,
      role: args.role ?? contact.role,
      updatedAt: now,
    });

    const channelsChanged =
      email !== contact.email || phoneNumber !== contact.phoneNumber;
    if (contact.invitationStatus === "pending" && channelsChanged) {
      const invitationToken = newInvitationToken();
      await ctx.db.patch(contact._id, { invitationToken, invitedAt: now });
      await deliverInvitation(ctx, userId, {
        contactId: contact._id,
        email,
        phoneNumber,
        invitationToken,
      });
    }
    return { success: true };
  },
});

/**
 * Normalize and validate a contact's email / phone for `userId`, refusing any
 * already held by another of their non-revoked contacts. `selfId` excludes the
 * row being edited.
 */
async function checkContactChannels(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { email?: string; phoneNumber?: string },
  selfId?: Id<"trusted_contacts">,
) {
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

  const others = (
    await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect()
  ).filter((c) => c._id !== selfId);

  // Dedup on whichever identifier(s) the contact carries.
  if (email && others.some((c) => c.email?.toLowerCase() === email)) {
    throw new ConvexError("A contact with this email already exists");
  }
  if (
    phoneNumber &&
    others.some((c) => normalizeE164(c.phoneNumber) === phoneNumber)
  ) {
    throw new ConvexError("A contact with this phone number already exists");
  }

  // C1: dedup by the distinct HUMAN, not just by channel. If this invitee
  // already has a Keeplas account whose verified email/phone backs a
  // non-revoked contact row for this owner, the same person is being invited
  // through a second channel. Block it — otherwise one person would hold two
  // rows (two quorum votes) and could reach the unreachability quorum
  // alone.
  const inviteeUserId = await resolveInviteePersonId(ctx, {
    email,
    phoneNumber,
  });
  if (inviteeUserId && others.some((c) => c.contactUserId === inviteeUserId)) {
    throw new ConvexError("This person is already one of your contacts");
  }

  return { email, phoneNumber };
}

function newInvitationToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Every delivery sends a Keeplas-branded email and/or a paid WhatsApp template
// to an address the owner typed (invite, resend, or a pending contact's
// changed channel). Cap them per owner so an account can't turn invitations
// into a spam or harassment channel. Far above what setting up a few contacts
// and fixing a typo needs.
const INVITE_DELIVERIES_PER_HOUR = 10;
const INVITE_DELIVERIES_PER_DAY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Send the accept link on every channel on file. Email is the canonical
 * channel; WhatsApp carries the same link and is the only one for phone-only
 * contacts. Throws once the owner exceeded their delivery budget, which rolls
 * the whole invite / resend / edit back.
 */
async function deliverInvitation(
  ctx: MutationCtx,
  userId: Id<"users">,
  invite: {
    contactId: Id<"trusted_contacts">;
    email?: string;
    phoneNumber?: string;
    invitationToken: string;
  },
) {
  // Keyed by the authenticated owner, not the caller's IP.
  await enforceIpRateLimit(
    ctx,
    "invite_delivery_hour",
    userId,
    INVITE_DELIVERIES_PER_HOUR,
  );
  await enforceIpRateLimit(
    ctx,
    "invite_delivery_day",
    userId,
    INVITE_DELIVERIES_PER_DAY,
    DAY_MS,
  );

  if (invite.email) {
    await ctx.scheduler.runAfter(
      0,
      internal.trusted_contacts.sendInvitationEmail,
      { contactId: invite.contactId },
    );
  }
  if (invite.phoneNumber) {
    const inviter = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.dispatch.sendInvitationWhatsApp, {
      phoneNumber: invite.phoneNumber,
      inviterName: formatSenderIdentity(inviter),
      invitationToken: invite.invitationToken,
      language: inviter?.language,
    });
  }
}

/** The trusted-contact row an invitation link points at, if any. */
async function invitationByToken(ctx: QueryCtx, token: string) {
  return await ctx.db
    .query("trusted_contacts")
    .withIndex("by_invitation_token", (q) => q.eq("invitationToken", token))
    .first();
}

/**
 * Get a contact invitation by token (public - no auth required). Invite links
 * outlive the invitation (mailboxes, chat backups), so this returns only what
 * the invite screen shows: the status, the inviter's display name and when the
 * link stops working. Never the invitee's or the inviter's email / phone.
 */
export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contact = await invitationByToken(ctx, args.token);
    if (!contact) return null;

    const inviter = await ctx.db.get(contact.userId);
    return {
      invitationStatus: contact.invitationStatus,
      inviterName: resolveInviterName(inviter),
      expiresAt: contact.invitedAt + INVITE_EXPIRY_MS,
    };
  },
});

/**
 * The pending, unexpired invitation behind `token`, for `answerer` to accept
 * or decline. #5: only the person the invite was addressed to may answer it —
 * a link leaked or forwarded to anyone else must not let an unrelated account
 * take or refuse the seat. The answering account must own (verified) the email
 * OR phone the invite was sent to. Unverified identifiers don't count — they'd
 * let an attacker self-assert the invited channel.
 */
async function requireInvitationFor(
  ctx: MutationCtx,
  token: string,
  answerer: Doc<"users">,
): Promise<Doc<"trusted_contacts">> {
  const contact = await invitationByToken(ctx, token);
  if (!contact) throw new Error("Invalid invitation token");
  if (contact.invitationStatus !== "pending") {
    throw new Error("This invitation has already been processed");
  }
  if (Date.now() > contact.invitedAt + INVITE_EXPIRY_MS) {
    throw new Error("This invitation has expired");
  }
  if (contact.userId === answerer._id) {
    throw new Error("You cannot answer your own invitation");
  }

  const invitedEmail = contact.email?.trim().toLowerCase() || undefined;
  const invitedPhone = normalizeE164(contact.phoneNumber);
  const verified = verifiedChannels(answerer);
  const answererEmail = verified.email?.trim().toLowerCase() || undefined;
  const answererPhone = normalizeE164(verified.phoneNumber);

  const emailMatches =
    invitedEmail !== undefined && answererEmail === invitedEmail;
  const phoneMatches =
    invitedPhone !== undefined && answererPhone === invitedPhone;
  if (!emailMatches && !phoneMatches) {
    throw new Error(
      "This invitation was sent to a different email or phone number.",
    );
  }
  return contact;
}

/** Audit actor for an invitee answering: the entry lives on the owner's chain. */
async function invitationActor(
  ctx: MutationCtx,
  token: string,
): Promise<ActorIdentity> {
  const contactUserId = await requireAuth(ctx);
  const contact = await invitationByToken(ctx, token);
  if (!contact) throw new Error("Invalid invitation token");
  return {
    chainUserId: contact.userId,
    actorType: "trusted_contact",
    actorId: contactUserId,
  };
}

/**
 * Resolve an invitee's identifiers to an existing Keeplas account, if any.
 * Used to dedup quorum participation by the distinct human (C1): two
 * contact rows must never resolve to the same `contactUserId` for one owner.
 * Matches only on a VERIFIED identifier (a user must have proven ownership of
 * the email/phone) so an unverified backfilled identifier can't be used to
 * shadow-claim someone else's account. Returns null when no account matches.
 */
async function resolveInviteePersonId(
  ctx: MutationCtx,
  identifiers: { email?: string; phoneNumber?: string },
): Promise<Id<"users"> | null> {
  if (identifiers.email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identifiers.email))
      .first();
    if (byEmail && byEmail.emailVerificationTime !== undefined) {
      return byEmail._id;
    }
  }
  if (identifiers.phoneNumber) {
    const byPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) =>
        q.eq("phoneNumber", identifiers.phoneNumber),
      )
      .first();
    if (byPhone && byPhone.phoneNumberVerifiedAt !== undefined) {
      return byPhone._id;
    }
  }
  return null;
}

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
  resolveActor: (ctx, args) => invitationActor(ctx, args.token),
  getResourceId: (_args, result) =>
    (result as { contactRecordId: string }).contactRecordId,
  handler: async (ctx, args) => {
    // Intentionally NOT step-up gated (requireAuth, not requireFullAuth): a
    // contact often accepts in the same breath as creating their account, so
    // their session may not have cleared the login-OTP gate yet. Gating here
    // would deadlock a just-signed-up contact out of accepting.
    const contactUserId = await requireAuth(ctx);
    const accepter = await ctx.db.get(contactUserId);
    if (!accepter) throw new Error("Invalid invitation token");
    const contact = await requireInvitationFor(ctx, args.token, accepter);

    // C1: never attach a `contactUserId` that already backs another non-revoked
    // contact row for the same owner. A single human must map to at most one
    // row (one quorum vote). Guards the path where two distinct
    // invites (e.g. one by email, one by phone) only resolve to the same person
    // at acceptance time.
    const ownerRows = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", contact.userId))
      .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
      .collect();
    if (
      ownerRows.some(
        (r) => r._id !== contact._id && r.contactUserId === contactUserId,
      )
    ) {
      throw new Error("You are already a contact for this vault owner");
    }

    const now = Date.now();

    // Mirror the accepting contact's identity material onto the row so the
    // owner can verify `contactPublicKey` before wrapping (finding #2). The
    // accepter IS the contact user, so we copy from their own user record.
    await ctx.db.patch(contact._id, {
      contactUserId,
      invitationStatus: "accepted",
      acceptedAt: now,
      contactPublicKey: args.contactPublicKey,
      contactIdentityPublicKey: accepter.identityPublicKey,
      contactPublicKeySignature: accepter.publicKeySignature,
      updatedAt: now,
    });

    // The invite's other identifier is NOT copied onto the accepter's account:
    // the inviting owner typed it, so it may not be theirs, and an account's
    // email / phone receive its own Life Check check-ins and security alerts.
    // The owner keeps it on this contact row to reach the contact.

    await createNotification(ctx, {
      userId: contact.userId,
      type: "contact_confirmed",
      title: "Contact accepted",
      body: `${formatSenderIdentity(contact)} accepted your invitation and is now a trusted contact.`,
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
  resolveActor: (ctx, args) => invitationActor(ctx, args.token),
  getResourceId: (_args, result) =>
    (result as { contactRecordId: string }).contactRecordId,
  handler: async (ctx, args) => {
    // Same rationale as acceptInvitation: a contact may decline right after
    // signing up, before clearing the login-OTP gate — left on requireAuth so
    // the gate can't lock them out of responding to the invitation.
    const userId = await requireAuth(ctx);
    const answerer = await ctx.db.get(userId);
    if (!answerer) throw new Error("Invalid invitation token");
    const contact = await requireInvitationFor(ctx, args.token, answerer);

    await ctx.db.patch(contact._id, {
      invitationStatus: "declined",
      updatedAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: contact.userId,
      type: "contact_invited",
      title: "Invitation declined",
      body: `${formatSenderIdentity(contact)} declined your trusted contact invitation.`,
      actionUrl: "/trusted-contacts",
      relatedId: contact._id,
      relatedType: "trusted_contact",
    });

    return { success: true, contactRecordId: contact._id };
  },
});

/**
 * Stamp `lastVerifiedAt` after the contact unlocked their own key material on
 * /shared-with-me (see useConfirmAvailability) — proof they can still open
 * what the owner wraps to them. Called by the contact, not the vault owner, so
 * the audit entry lives on the owner's chain.
 */
export const confirmAvailability = auditedMutation({
  action: "trusted_contact.availability_confirmed",
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
    // Contact-side op: step-up gated. The contact has long since accepted the
    // invitation by the time they re-confirm, so the gate is reliably
    // clearable for them (unlike acceptInvitation, which can run in the same
    // breath as their signup).
    const contactUserId = await requireFullAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.contactUserId !== contactUserId) {
      throw new Error("Contact not found");
    }
    if (contact.invitationStatus !== "accepted") {
      throw new Error("Access has been revoked");
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
    const userId = await requireFullAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    if (contact.invitationStatus === "revoked") {
      throw new Error("Contact is already revoked");
    }

    await ctx.db.patch(args.contactId, {
      invitationStatus: "revoked",
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
    const userId = await requireFullAuth(ctx);

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    if (contact.invitationStatus !== "pending") {
      throw new Error("Can only resend for pending invitations");
    }

    const invitationToken = newInvitationToken();
    await ctx.db.patch(args.contactId, {
      invitationToken,
      invitedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await deliverInvitation(ctx, userId, {
      contactId: args.contactId,
      email: contact.email,
      phoneNumber: contact.phoneNumber,
      invitationToken,
    });
    return { invitationToken };
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
    // Intentionally NOT step-up gated: this runs as part of a contact bringing
    // their crypto online right after accepting (often same session as signup),
    // mirroring the acceptInvitation rationale. Gating it would block a fresh
    // contact from publishing the public key the owner needs to wrap to them.
    const userId = await requireAuth(ctx);
    // The republishing caller IS the contact user, so we mirror their identity
    // material (finding #2) onto every owner's row alongside the ML-KEM key.
    const me = await ctx.db.get(userId);
    const patched = await publishContactKeyToOwnerRows(ctx, userId, {
      contactPublicKey: args.contactPublicKey,
      contactIdentityPublicKey: me?.identityPublicKey,
      contactPublicKeySignature: me?.publicKeySignature,
    });
    return { patched };
  },
});

/**
 * TOFU pin (finding #2). The OWNER pins a contact's identity-key fingerprint
 * the first time the client successfully verifies it for wrapping. The
 * fingerprint is computed client-side (`identityKeyFingerprint`) so the server
 * never decides what is trusted — it only persists the owner's decision.
 *
 * First-pin only: refuses if the row already carries a pin. A deliberate
 * key change goes through the separate, explicit `repinContactIdentity`, so a
 * silent server substitution can never overwrite an existing pin.
 */
export const pinContactIdentity = auditedMutation({
  action: "trusted_contact.identity_pinned",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
  args: {
    contactId: v.id("trusted_contacts"),
    fingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    if (contact.pinnedIdentityFingerprint) {
      throw new Error("Contact identity is already pinned");
    }
    await ctx.db.patch(args.contactId, {
      pinnedIdentityFingerprint: args.fingerprint,
      updatedAt: Date.now(),
    });
    return { pinned: true };
  },
});

/**
 * Explicit re-pin (finding #2). Used ONLY when the owner deliberately accepts
 * a contact's identity-key change after the blocking alert — never automatic.
 * Overwrites the existing pin with the new fingerprint the owner reviewed.
 */
export const repinContactIdentity = auditedMutation({
  action: "trusted_contact.identity_repinned",
  resourceType: "trusted_contact",
  getResourceId: (args) => args.contactId,
  args: {
    contactId: v.id("trusted_contacts"),
    fingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }
    await ctx.db.patch(args.contactId, {
      pinnedIdentityFingerprint: args.fingerprint,
      updatedAt: Date.now(),
    });
    return { repinned: true };
  },
});

/**
 * Get contacts where the current user is the invited contact (for contact's hub).
 */
export const getVaultsWhereIAmContact = query({
  args: {},
  handler: async (ctx) => {
    // Contact's own hub view. Intentionally NOT step-up gated: it is the
    // landing surface a contact may hit right after signing up to accept an
    // invitation, before clearing their login-OTP gate. It exposes only the
    // contact's own relationship rows (never the owner's vault content), so
    // leaving it on requireAuth keeps the contact onboarding path unblocked.
    const userId = await requireAuth(ctx);
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_contact_user", (q) => q.eq("contactUserId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    // Enrich with vault owner info + most recent active life-check cycle
    // status, so the contact UI can gate "Mark as unreachable" on escalation,
    // and the owner's confirmation threshold, so it can explain the release.
    const result = [];
    for (const contact of contacts) {
      const owner = ownerDisplay(await ctx.db.get(contact.userId));
      const ownerConfig = await ctx.db
        .query("life_check_configs")
        .withIndex("by_user", (q) => q.eq("userId", contact.userId))
        .first();

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
      // Whether I already confirmed the owner can't be reached (one vote per
      // contact row), so the contact UI swaps the action for a waiting state.
      const unreachableConfirmed = (
        await ctx.db
          .query("access_requests")
          .withIndex("by_status", (q) =>
            q.eq("vaultUserId", contact.userId).eq("status", "pending"),
          )
          .collect()
      ).some((r) => r.contactsInitiated?.includes(contact._id));
      const releasedItemCount = releaseReq
        ? releaseReq.sectionsRequested.filter((s) => s.startsWith("item:"))
            .length
        : 0;

      result.push({
        ...contact,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerPhone: owner.phone,
        confirmationThreshold:
          ownerConfig?.confirmationThreshold ?? DEFAULT_CONFIRMATION_THRESHOLD,
        ownerCycleStatus: activeCycle?.status ?? null,
        released: !!releaseReq,
        releasedItemCount,
        unreachableConfirmed,
      });
    }
    return result;
  },
});

/**
 * Send the invitation email (with its acceptance link) to a freshly invited
 * (or re-invited) contact.
 *
 * No-ops gracefully when Resend credentials are missing so dev environments
 * without external integrations still work.
 */
export const sendInvitationEmail = internalAction({
  args: { contactId: v.id("trusted_contacts") },
  handler: async (ctx, args) => {
    if (isNotificationsPaused()) return "paused";
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
    const locale = resolveLocale(data.inviterLanguage);
    const inviterName = formatSenderIdentity(
      {
        name: data.inviterName,
        email: data.inviterEmail,
        phoneNumber: data.inviterPhone,
      },
      locale === "fr" ? "Un utilisateur Keeplas" : "A Keeplas user",
    );

    const subject = INVITE_EMAIL_COPY[locale].subject(inviterName);
    const html = invitationHtml({
      appUrl,
      recipientName: data.name,
      inviterName,
      acceptUrl,
      locale,
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
      invitationStatus: contact.invitationStatus,
      invitationToken: contact.invitationToken,
      inviterName: inviter?.name ?? null,
      inviterEmail: inviter?.email ?? null,
      inviterPhone: inviter?.phoneNumber ?? null,
      // Drive the invite email's language off the inviter's preference — the
      // invitee has no account (hence no locale) until they accept.
      inviterLanguage: inviter?.language ?? null,
    };
  },
});

// Email copy mirrors the Infobip WhatsApp template (`keeplas_invite_tc_*`) so
// the two channels carry matching wording.
const INVITE_EMAIL_COPY = {
  en: {
    subject: (inviter: string) =>
      `${inviter} invited you as a trusted contact on Keeplas`,
    greeting: (name: string) => `Hi ${name},`,
    trustBody: (inviter: string) =>
      `<strong>${inviter}</strong> has chosen you as a trusted contact on Keeplas, the zero-knowledge life-continuity platform.`,
    trustExplain:
      "As a trusted contact, you'll help confirm if something happens to them, so the items they chose reach the right people. You won't see any of their data.",
    accept: "Accept invitation",
    expiry: (url: string) =>
      `This link expires in 7 days. If the button doesn't work, open this URL in your browser:<br/><a href="${url}" style="color:#0E2340;word-break:break-all">${url}</a>`,
    ignoreInvite:
      "If you weren't expecting this invitation, you can ignore this email.",
  },
  fr: {
    subject: (inviter: string) =>
      `${inviter} vous a désigné comme contact de confiance sur Keeplas`,
    greeting: (name: string) => `Bonjour ${name},`,
    trustBody: (inviter: string) =>
      `<strong>${inviter}</strong> vous a choisi comme contact de confiance sur Keeplas, la plateforme de continuité de vie à connaissance nulle.`,
    trustExplain:
      "En tant que contact de confiance, vous aiderez à confirmer s'il lui arrive quelque chose, afin que les éléments qu'elle a choisis parviennent aux bonnes personnes. Vous n'aurez accès à aucune de ses données.",
    accept: "Accepter l'invitation",
    expiry: (url: string) =>
      `Ce lien est valable 7 jours. Si le bouton ne fonctionne pas, ouvrez cette URL dans votre navigateur :<br/><a href="${url}" style="color:#0E2340;word-break:break-all">${url}</a>`,
    ignoreInvite:
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
  },
} satisfies Record<Locale, Record<string, string | ((arg: string) => string)>>;

function invitationHtml(opts: {
  appUrl: string;
  recipientName: string;
  inviterName: string;
  acceptUrl: string;
  locale: Locale;
}) {
  const copy = INVITE_EMAIL_COPY[opts.locale];
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:520px;margin:auto;padding:24px">
<p style="text-align:center;margin:0 0 24px"><img src="${opts.appUrl}/assets/logo/logo-wordmark.svg" alt="Keeplas" width="200" height="40" style="display:inline-block;border:0;outline:none;text-decoration:none"/></p>
<p>${copy.greeting(escapeHtml(opts.recipientName))}</p>
<p>${copy.trustBody(escapeHtml(opts.inviterName))}</p>
<p>${copy.trustExplain}</p>
<p style="margin:32px 0;text-align:center"><a href="${opts.acceptUrl}" style="display:inline-block;padding:12px 28px;background:#0E2340;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">${copy.accept}</a></p>
<p style="color:#666;font-size:13px">${copy.expiry(opts.acceptUrl)}</p>
<p style="color:#666;font-size:13px;margin-top:24px">${copy.ignoreInvite}</p>
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
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // matches the accept-link TTL + WhatsApp template (keeplas_invite_tc)

/**
 * Weekly availability re-confirmation sweep (driven by crons.ts). Two gaps
 * it closes:
 *
 *  - An accepted trust contact whose availability check is missing or older
 *    than 30 days gets nudged (in-app + email, plus WhatsApp when a phone is
 *    on file) to re-verify. After 3 ignored nudges the vault owner is alerted
 *    once to replace the unresponsive contact.
 *  - A trust invitation still "pending" past its 7-day accept window alerts the
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
            body: `${formatSenderIdentity(c)} never accepted your invitation. Replace them so your continuity protocol stays operational.`,
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

      // Gap 1: accepted but availability check missing/stale.
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
      const ownerName = formatSenderIdentity(owner);

      await createNotification(ctx, {
        userId: c.contactUserId,
        type: "vault_update",
        title: "Are you still available as a trusted contact?",
        body: `Please open Keeplas to confirm you can still act as ${ownerName}'s trusted contact so their continuity protection stays active.`,
        channels: ["push", "email"],
        actionUrl: "/shared-with-me",
        relatedId: c._id,
        relatedType: "trusted_contact",
      });

      if (c.phoneNumber) {
        const contactUser = c.contactUserId
          ? await ctx.db.get(c.contactUserId)
          : null;
        await ctx.scheduler.runAfter(
          0,
          internal.dispatch.sendReconfirmWhatsApp,
          {
            phoneNumber: c.phoneNumber,
            ownerName,
            language: contactUser?.language ?? owner?.language,
          },
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
          body: `${formatSenderIdentity(c)} hasn't confirmed their availability after several reminders. Replace them so your continuity protocol stays operational.`,
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
