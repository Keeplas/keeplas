import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { optionalAuth, requireAuth } from "./helpers";
import { auditedMutation, createAuditLog } from "./audit";
import { normalizeE164 } from "./lib/phone";

const EIGHTEEN_YEARS_MS = 18 * 365.25 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 130 * 365.25 * 24 * 60 * 60 * 1000;

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    return await ctx.db.get(userId);
  },
});

/**
 * Whether a password (email) account exists for `email`. The login form calls
 * this after a failed sign-in to tell apart "no account" (point the user to
 * signup) from "wrong password" (keep the generic credentials error). Queries
 * the exact email string — no normalization — to mirror the Password
 * provider's case-sensitive `account: { id: email }` lookup.
 */
export const accountExistsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!args.email) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user !== null;
  },
});

/**
 * Update the user's profile fields (name, phone, avatar).
 * Email is controlled by the auth provider and cannot be changed here.
 */
export const updateProfile = auditedMutation({
  action: "user.profile.updated",
  resourceType: "user",
  args: {
    name: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.phoneNumber !== undefined) {
      const next = normalizeE164(args.phoneNumber);
      patch.phoneNumber = next;
      // Changing the phone invalidates any previous verification.
      const current = await ctx.db.get(userId);
      if (current?.phoneNumber !== next) {
        patch.phoneNumberVerifiedAt = undefined;
      }
    }
    if (args.avatarUrl !== undefined)
      patch.avatarUrl = args.avatarUrl.trim() || undefined;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Persist the legal identity collected during the `legal_info` onboarding
 * step. Birthday is validated server-side (>= 18 years, plausible upper
 * bound) and the country is normalized to ISO-3166-1 alpha-2. The audit
 * entry produced here is the user's signed declaration of identity — keep
 * the entry's metadata stable, it will be the anchor of the chain in any
 * future succession proceeding.
 */
export const completeLegalInfo = auditedMutation({
  action: "user.legal_info.confirmed",
  resourceType: "user",
  args: {
    birthday: v.number(),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    if (!Number.isFinite(args.birthday)) {
      throw new Error("Invalid birthday");
    }
    const ageMs = now - args.birthday;
    if (ageMs < EIGHTEEN_YEARS_MS) {
      throw new Error("You must be at least 18 years old to use Keeplas");
    }
    if (ageMs > MAX_AGE_MS) {
      throw new Error("Birthday is implausibly old");
    }

    const country = args.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new Error("Country must be a 2-letter ISO-3166-1 code");
    }

    await ctx.db.patch(userId, {
      birthday: args.birthday,
      country,
      legalInfoConfirmedAt: now,
      onboardingStep: "recovery_phrase",
      updatedAt: now,
    });
  },
  getMetadata: (args) => ({
    country: args.country.toUpperCase(),
    // Store year-of-birth only (not full timestamp) in metadata to keep the
    // audit entry's PII surface minimal — the full birthday lives on the
    // user record itself.
    birthYear: new Date(args.birthday).getUTCFullYear(),
  }),
});

/**
 * Update the country of legal residence after the initial onboarding
 * declaration (e.g. when the user moves jurisdictions). The original
 * `legalInfoConfirmedAt` timestamp is preserved — it remains the anchor
 * of the audit chain — and a new `user.legal_info.updated` entry records
 * the previous and new country so the succession trail stays auditable.
 *
 * Birthday is intentionally not editable: it is a fact, not a preference,
 * and changing it would invalidate the original signed declaration.
 */
export const updateLegalResidence = auditedMutation({
  action: "user.legal_info.updated",
  resourceType: "user",
  args: {
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const country = args.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new Error("Country must be a 2-letter ISO-3166-1 code");
    }

    const previousCountry = user.country ?? null;
    if (previousCountry === country) {
      throw new Error("New country is the same as the current one");
    }

    await ctx.db.patch(userId, {
      country,
      updatedAt: Date.now(),
    });

    return { previousCountry, newCountry: country };
  },
  getMetadata: (_args, result) => ({
    previousCountry: result.previousCountry,
    newCountry: result.newCountry,
  }),
});

/**
 * Lazily set the user's ML-KEM-768 (post-quantum) keypair used for
 * per-recipient DEK wrapping. The public key is stored in cleartext; the
 * secret key is encrypted client-side under the user's MasterKey and
 * stored in the dedicated `encryptedAsymmetricSecretKey` field — distinct
 * from `encryptedKeyBundle` which holds the MasterKey wrap itself.
 *
 * Idempotent: re-running with the same keypair is a no-op; calling with a
 * different public key is rejected to avoid silently invalidating prior
 * wrapped DEKs.
 */
export const setPublicKey = auditedMutation({
  action: "user.public_key.set",
  resourceType: "user",
  args: {
    publicKey: v.string(),
    encryptedAsymmetricSecretKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (user.publicKey && user.publicKey !== args.publicKey) {
      throw new Error("A different public key is already set for this account");
    }

    await ctx.db.patch(userId, {
      publicKey: args.publicKey,
      encryptedAsymmetricSecretKey: args.encryptedAsymmetricSecretKey,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update the user's platform preferences (language, timezone).
 */
export const updatePreferences = auditedMutation({
  action: "user.preferences.updated",
  resourceType: "user",
  args: {
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.language !== undefined) patch.language = args.language;
    if (args.timezone !== undefined) patch.timezone = args.timezone;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Wipe every record owned by `userId` while preserving the `audit_logs` table
 * (the on-chain trail must outlive the user). Writes a final tamper-evident
 * audit entry BEFORE deletion so the wipe itself is recorded in the chain.
 */
export async function wipeUserData(
  ctx: MutationCtx,
  userId: Id<"users">,
  actor: {
    actorType: "user" | "trusted_contact" | "system" | "ai_assistant";
    actorId: string;
  },
) {
  await createAuditLog(ctx, {
    userId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    action: "account_wipe_executed",
    resourceType: "user",
    resourceId: userId,
  });

  const tablesByUser = [
    "vault_items",
    "trusted_contacts",
    "life_check_configs",
    "life_check_cycles",
    "passive_signals",
    "conditional_messages",
    "notifications",
    "vaults",
  ] as const;

  for (const table of tablesByUser) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }

  const accessRequests = await ctx.db
    .query("access_requests")
    .withIndex("by_vault_user", (q) => q.eq("vaultUserId", userId))
    .collect();
  for (const row of accessRequests) {
    await ctx.db.delete(row._id);
  }

  await ctx.db.delete(userId);
}

/**
 * User-initiated permanent deletion. Requires the literal "DELETE"
 * confirmation phrase and that the user has already re-authenticated upstream.
 * `audit_logs` are intentionally preserved (immutable on-chain trail).
 */
export const deleteAccount = auditedMutation({
  action: "user.account.deleted",
  resourceType: "user",
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmation !== "DELETE") {
      throw new Error("Confirmation phrase mismatch");
    }
    const userId = await requireAuth(ctx);

    await wipeUserData(ctx, userId, {
      actorType: "user",
      actorId: userId,
    });

    return { success: true };
  },
});
