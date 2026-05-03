import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, optionalAuth } from "./helpers";
import { auditedMutation } from "./audit";

// ─── Queries ────────────────────────────────────────────

/**
 * Get the current user's emergency card.
 */
export const getMyCard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    return await ctx.db
      .query("emergency_cards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Get an emergency card by its QR code token (public, no auth required).
 * Resolves the linked trusted contact server-side so the public payload
 * stays a flat snapshot — readers never see the contact reference.
 */
export const getByQrToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query("emergency_cards")
      .withIndex("by_qr_token", (q) => q.eq("qrCodeToken", args.token))
      .first();

    if (!card || !card.isActive) return null;

    let emergencyContactName: string | undefined;
    let emergencyContactPhone: string | undefined;
    if (card.showEmergencyContact && card.emergencyContactId) {
      const contact = await ctx.db.get(card.emergencyContactId);
      if (contact && contact.userId === card.userId && contact.invitationStatus !== "revoked") {
        emergencyContactName = contact.name;
        emergencyContactPhone = contact.phoneNumber;
      }
    }

    return {
      fullName: card.showFullName ? card.fullName : undefined,
      bloodType: card.showBloodType ? card.bloodType : undefined,
      allergies: card.showAllergies ? card.allergies : undefined,
      medicalConditions: card.showMedicalConditions
        ? card.medicalConditions
        : undefined,
      medications: card.showMedications ? card.medications : undefined,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation: card.showEmergencyContact
        ? card.emergencyContactRelation
        : undefined,
      additionalNotes: card.showAdditionalNotes
        ? card.additionalNotes
        : undefined,
      updatedAt: card.updatedAt,
    };
  },
});

// ─── Mutations ──────────────────────────────────────────

/**
 * Create or update the user's emergency card (one card per user).
 */
export const createOrUpdate = auditedMutation({
  action: "emergency_card.upserted",
  resourceType: "emergency_card",
  getResourceId: (_args, result) => result as string,
  args: {
    fullName: v.optional(v.string()),
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medicalConditions: v.optional(v.string()),
    medications: v.optional(v.string()),
    emergencyContactId: v.optional(v.id("trusted_contacts")),
    emergencyContactRelation: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),

    showFullName: v.boolean(),
    showBloodType: v.boolean(),
    showAllergies: v.boolean(),
    showEmergencyContact: v.boolean(),
    showMedicalConditions: v.boolean(),
    showMedications: v.boolean(),
    showAdditionalNotes: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    if (args.emergencyContactId) {
      const contact = await ctx.db.get(args.emergencyContactId);
      if (!contact || contact.userId !== userId) {
        throw new Error("Trusted contact not found");
      }
    }

    const existing = await ctx.db
      .query("emergency_cards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Use replace (not patch) so any orphan fields from previous schema
      // versions are dropped — patch leaves unknown keys behind, which then
      // fail strict schema validation on the merged document.
      await ctx.db.replace(existing._id, {
        userId: existing.userId,
        qrCodeToken: existing.qrCodeToken,
        qrCodeUrl: existing.qrCodeUrl,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
        lastPrintedAt: existing.lastPrintedAt,
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    const qrCodeToken = generateQrToken();

    const cardId = await ctx.db.insert("emergency_cards", {
      userId,
      ...args,
      qrCodeToken,
      qrCodeUrl: `/emergency/${qrCodeToken}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return cardId;
  },
});

/**
 * Record that the card was printed.
 */
export const markPrinted = auditedMutation({
  action: "emergency_card.printed",
  resourceType: "emergency_card",
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const card = await ctx.db
      .query("emergency_cards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!card) throw new Error("No emergency card found");

    await ctx.db.patch(card._id, { lastPrintedAt: Date.now() });
  },
});

// ─── Helpers ────────────────────────────────────────────

function generateQrToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
