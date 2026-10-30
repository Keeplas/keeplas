import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { optionalAuth, requireAuth, requireFullAuth } from "./helpers";
import { vaultGroupValidator } from "./validators";
import { auditedMutation, createAuditLog } from "./audit";
import {
  claimNewUpload,
  deleteBlob,
  generateBlobUploadUrl,
  getBlobDownloadUrl,
  storageRefValidator,
} from "./lib/storage";
import { normalizeUserLanguage } from "./lib/locale";
import { cleanName } from "./lib/text";
import { publishContactKeyToOwnerRows } from "./lib/contact_key";

const EIGHTEEN_YEARS_MS = 18 * 365.25 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 130 * 365.25 * 24 * 60 * 60 * 1000;

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    // An allowlist, not a spread: a field added to `users` stays on the
    // server until a client needs it. Left out on purpose: the 24-word
    // verifiers (they work like passwords), and `lastSeenAt` (a heartbeat
    // that would re-send the multi-KB key bundle to every client).
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      email: user.email,
      emailVerificationTime: user.emailVerificationTime,
      name: user.name,
      // Resolved on every read, never stored (see `avatarStorageId`).
      avatarUrl: user.avatarStorageId
        ? ((await getBlobDownloadUrl(ctx, user.avatarStorageId)) ?? undefined)
        : user.avatarUrl,
      phoneNumber: user.phoneNumber,
      phoneNumberVerifiedAt: user.phoneNumberVerifiedAt,
      timezone: user.timezone,
      language: user.language,
      hiddenCategoryGroups: user.hiddenCategoryGroups,
      publicKey: user.publicKey,
      encryptedKeyBundle: user.encryptedKeyBundle,
      encryptedAsymmetricSecretKey: user.encryptedAsymmetricSecretKey,
      encryptedAsymmetricSecretKeyPrev: user.encryptedAsymmetricSecretKeyPrev,
      identityPublicKey: user.identityPublicKey,
      encryptedIdentitySecretKey: user.encryptedIdentitySecretKey,
      publicKeySignature: user.publicKeySignature,
      phraseSalt: user.phraseSalt,
      recoveryVerified: user.recoveryVerified,
      masterKeyRotationRequired: user.masterKeyRotationRequired,
      birthday: user.birthday,
      country: user.country,
      plan: user.plan,
    };
  },
});

/**
 * Resolve a user's stored UI language by email (BCP-47 tag like "fr-FR", or
 * undefined). Internal-only — used by the auth Email provider to send the
 * signup/verification email in the recipient's chosen language. Matches the
 * exact email string via the `email` index, mirroring the Password provider.
 */
export const getLanguageByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!args.email) return undefined;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?.language ?? undefined;
  },
});

/**
 * Update mutable profile fields (currently only `name`). Email and phone are
 * identifiers — changes go through the OTP-gated flows in
 * `email_verification` / `phone_verification` so the auth accounts rotate
 * atomically and the change lands on the audit chain. The avatar is uploaded
 * separately via `generateAvatarUploadUrl` / `setAvatarImage`.
 */
export const updateProfile = auditedMutation({
  action: "user.profile.updated",
  resourceType: "user",
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = cleanName(args.name) || undefined;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Issue a short-lived signed URL so the client can POST the avatar image
 * directly to Convex storage. Unlike vault blobs, the avatar is not
 * client-encrypted — it is a profile picture, not vault content.
 */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await generateBlobUploadUrl(ctx, userId);
  },
});

/**
 * Persist a freshly uploaded avatar image: store its storage handle (the
 * serving URL is resolved on read, see `viewer`) and delete the previously
 * uploaded blob so replacements don't orphan storage. Returns the serving URL
 * so the client can preview it immediately.
 */
export const setAvatarImage = auditedMutation({
  action: "user.profile.updated",
  resourceType: "user",
  args: { storageId: storageRefValidator },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Same blob again = a retried save. Otherwise only a brand-new upload:
    // the avatar deletes its blob later, so it must never take a vault file's.
    const isCurrent = user.avatarStorageId === args.storageId;
    const url = await getBlobDownloadUrl(ctx, args.storageId);
    if (
      !url ||
      (!isCurrent && !(await claimNewUpload(ctx, args.storageId, userId)))
    ) {
      throw new Error("Uploaded image could not be resolved");
    }

    if (user.avatarStorageId && !isCurrent) {
      await deleteBlob(ctx, user.avatarStorageId, userId);
    }

    await ctx.db.patch(userId, {
      avatarUrl: undefined,
      avatarStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    return url;
  },
});

/**
 * Clear the user's avatar: drop the URL + storage handle and delete the
 * underlying blob if it was an uploaded one.
 */
export const removeAvatar = auditedMutation({
  action: "user.profile.updated",
  resourceType: "user",
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (user.avatarStorageId) {
      await deleteBlob(ctx, user.avatarStorageId, userId);
    }

    await ctx.db.patch(userId, {
      avatarUrl: undefined,
      avatarStorageId: undefined,
      updatedAt: Date.now(),
    });
  },
});

function assertAdultBirthday(birthday: number, now: number) {
  if (!Number.isFinite(birthday)) {
    throw new Error("Invalid birthday");
  }
  const ageMs = now - birthday;
  if (ageMs < EIGHTEEN_YEARS_MS) {
    throw new Error("You must be at least 18 years old to use Keeplas");
  }
  if (ageMs > MAX_AGE_MS) {
    throw new Error("Birthday is implausibly old");
  }
}

/**
 * Correct the birthday from Settings. Needs a stepped-up session, like every
 * other edit of the legal identity.
 */
export const updateBirthday = auditedMutation({
  action: "user.birthday.updated",
  resourceType: "user",
  args: { birthday: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const now = Date.now();
    assertAdultBirthday(args.birthday, now);
    await ctx.db.patch(userId, { birthday: args.birthday, updatedAt: now });
  },
  getMetadata: (args) => ({
    birthYear: new Date(args.birthday).getUTCFullYear(),
  }),
});

/**
 * Update the country of legal residence after the initial onboarding
 * declaration (e.g. when the user moves jurisdictions). The original
 * `legalInfoConfirmedAt` timestamp is preserved — it remains the anchor
 * of the audit chain — and a new `user.legal_info.updated` entry records
 * the previous and new country so the succession trail stays auditable.
 */
export const updateLegalResidence = auditedMutation({
  action: "user.legal_info.updated",
  resourceType: "user",
  args: {
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
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
 * Write-once: re-running with the exact same material is a no-op (a retried
 * setup); any other change once a key is published is rejected. The identity
 * key is what the "vault" session proof checks and what owners pin, so a
 * weaker session must never swap it (or the wrapped secrets) behind an
 * unchanged ML-KEM key. Deliberate changes go through `rotation.ts`.
 *
 * Identity-key fields (finding #2 — malicious-server key substitution) are
 * accepted alongside the ML-KEM keypair: `identityPublicKey` (ML-DSA-65 public
 * key), `encryptedIdentitySecretKey` (identity secret key wrapped under the
 * MasterKey, mirroring `encryptedAsymmetricSecretKey`), and
 * `publicKeySignature` (ML-DSA signature binding the ML-KEM public key to the
 * identity). They are optional to keep existing rows and callers valid; step 2
 * starts verifying `publicKeySignature` before wrapping to this user.
 */
export const setPublicKey = auditedMutation({
  action: "user.public_key.set",
  resourceType: "user",
  args: {
    publicKey: v.string(),
    encryptedAsymmetricSecretKey: v.string(),
    identityPublicKey: v.optional(v.string()),
    encryptedIdentitySecretKey: v.optional(v.string()),
    publicKeySignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (
      user.publicKey &&
      (user.publicKey !== args.publicKey ||
        user.encryptedAsymmetricSecretKey !==
          args.encryptedAsymmetricSecretKey ||
        user.identityPublicKey !== args.identityPublicKey ||
        user.encryptedIdentitySecretKey !== args.encryptedIdentitySecretKey ||
        user.publicKeySignature !== args.publicKeySignature)
    ) {
      throw new Error("Key material is already set for this account");
    }

    await ctx.db.patch(userId, {
      publicKey: args.publicKey,
      encryptedAsymmetricSecretKey: args.encryptedAsymmetricSecretKey,
      identityPublicKey: args.identityPublicKey,
      encryptedIdentitySecretKey: args.encryptedIdentitySecretKey,
      publicKeySignature: args.publicKeySignature,
      updatedAt: Date.now(),
    });

    // Close the accept-before-crypto gap: a contact who accepted an invitation
    // before their keypair existed left the owner's row with an empty
    // `contactPublicKey`. Now that their key material is set, backfill every
    // owner's accepted row so the owner can wrap DEKs to them — without
    // waiting for a manual `/shared-with-me` visit. Idempotent.
    await publishContactKeyToOwnerRows(ctx, userId, {
      contactPublicKey: args.publicKey,
      contactIdentityPublicKey: args.identityPublicKey,
      contactPublicKeySignature: args.publicKeySignature,
    });
  },
});

/** Built-in categories the user deleted (or restored) in Settings. */
export const setHiddenCategoryGroups = auditedMutation({
  action: "user.categories.updated",
  resourceType: "user",
  args: { groups: v.array(vaultGroupValidator) },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await ctx.db.patch(userId, {
      hiddenCategoryGroups: [...new Set(args.groups)],
      updatedAt: Date.now(),
    });
  },
  getMetadata: (args) => ({ groups: args.groups }),
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
    if (args.language !== undefined) {
      patch.language = normalizeUserLanguage(args.language);
    }
    if (args.timezone !== undefined) patch.timezone = args.timezone;

    await ctx.db.patch(userId, patch);
  },
});
