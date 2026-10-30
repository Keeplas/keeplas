import { v, ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { query, type MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireFullAuth } from "./helpers";
import { auditedMutation } from "./audit";
import { requireSessionProof } from "./session_proofs";
import { publishContactKeyToOwnerRows } from "./lib/contact_key";
import { endSessions } from "./lib/sessions";

/**
 * Master-key rotation, run on the owner's phone (apps/mobile
 * features/vault/rotate-vault.ts). For key material that may have leaked: a
 * lost or stolen device, a device removed as untrusted ("It wasn't me"),
 * MasterKey shards that once sat with contacts, a release the owner revoked.
 *
 * What it renews: the MasterKey, the owner ML-KEM keypair and ML-DSA
 * identity, every DEK wrap (owner and recipients), the category and folder
 * names sealed under the MasterKey, the contact pins, and at finalize the
 * RootKey (new 24 words, salt and verifier; the phone re-seals the cloud
 * backup). Every other session is signed out.
 *
 * What it does NOT renew: item DEKs. Content, files and versions stay under
 * the DEK they were sealed with, and later edits keep it. Whoever already
 * unwrapped an item's DEK (a contact after a release, a device that had the
 * item open, the holder of a leaked owner secret key and an old wrap) can
 * still read that item's ciphertext if they obtain it. Rotation stops them
 * from opening new items and from using the new keys; re-keying content would
 * mean re-encrypting and re-uploading every file and version (not built).
 *
 * Crash safety: at every committed state, some key the owner's phone holds
 * opens every item.
 *  - `rotateKeyMaterial` wraps the new MasterKey under the CURRENT RootKey (a
 *    phone that lost the response reopens the bundle with the RootKey it
 *    holds), keeps the previous owner secret in `…Prev`, and refuses while a
 *    rotation is in progress: the phone resumes it instead of starting over.
 *  - The phone re-wraps every item (idempotent) until a fresh read shows
 *    nothing left on an older key.
 *  - `finalizeRotation` moves the previous secret into the retired-key
 *    archive (never dropped: wraps others sealed to it must still open) and
 *    installs the new RootKey.
 */

/**
 * Replacing the identity key and the key bundle: every step-up gate plus a
 * "vault" proof from this session, i.e. the CURRENT identity key signed a
 * nonce (or the 24 words matched at sign-in). A WhatsApp code alone (a
 * number takeover) must not swap the keys.
 */
async function requireVaultProvenAuth(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await requireFullAuth(ctx);
  await requireSessionProof(ctx, "vault");
  return userId;
}

const nameValidator = <T extends "vault_categories" | "folders">(table: T) =>
  v.object({ id: v.id(table), encryptedName: v.string() });

/**
 * Replace every name of `rows` (all of the user's rows in a table sealed
 * under the MasterKey) with its re-sealed copy. Refuses unless `names` holds
 * exactly those rows: a name left under the old MasterKey would be lost.
 */
async function resealNames(
  ctx: MutationCtx,
  rows: { _id: Id<"vault_categories"> | Id<"folders"> }[],
  names: {
    id: Id<"vault_categories"> | Id<"folders">;
    encryptedName: string;
  }[],
) {
  const byId = new Map<string, string>(
    names.map((name) => [name.id, name.encryptedName]),
  );
  if (rows.length !== byId.size || rows.some((row) => !byId.has(row._id))) {
    throw new ConvexError("NAMES_CHANGED");
  }
  for (const row of rows) {
    await ctx.db.patch(row._id, { encryptedName: byId.get(row._id)! });
  }
}

/**
 * Atomically swap the user's key material to a freshly generated master key
 * and owner ML-KEM keypair. Unlike `users.setPublicKey`, this deliberately
 * OVERWRITES an existing public key — rotation is the one place that must.
 */
export const rotateKeyMaterial = auditedMutation({
  action: "vault.key_material_rotated",
  resourceType: "user",
  args: {
    // New v2 bundle: the new master key wrapped under the CURRENT RootKey.
    // The RootKey is renewed at finalize, once the phone holds the new key.
    encryptedKeyBundle: v.string(),
    // New owner ML-KEM public key.
    publicKey: v.string(),
    // New ML-DSA signature over the new ML-KEM public-key bytes (finding #2).
    // Rotation changes `publicKey`, so the old signature would be stale —
    // contacts verify-before-wrap against this, so it must be re-signed
    // atomically with the new key, never left dangling.
    publicKeySignature: v.string(),
    identityPublicKey: v.string(),
    encryptedIdentitySecretKey: v.string(),
    // New owner secret key, AES-GCM wrapped under the NEW master key.
    encryptedAsymmetricSecretKey: v.string(),
    // OLD owner secret key, AES-GCM wrapped under the NEW master key — keeps
    // pre-rotation items readable until they are re-wrapped.
    encryptedAsymmetricSecretKeyPrev: v.string(),
    // Every retired secret (earlier rotations and the one just replaced),
    // re-sealed under the NEW master key.
    encryptedRetiredSecretKeys: v.string(),
    // Every category / folder name of the user, re-sealed under the NEW
    // master key.
    categoryNames: v.array(nameValidator("vault_categories")),
    folderNames: v.array(nameValidator("folders")),
    // Contact pins are MACed under a key derived from the master key: each
    // pin that verified under the old one, re-MACed under the new one.
    contactPins: v.array(
      v.object({
        contactId: v.id("trusted_contacts"),
        fingerprint: v.string(),
        mac: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireVaultProvenAuth(ctx);
    const user = await ctx.db.get(userId);
    if (user?.encryptedAsymmetricSecretKeyPrev) {
      // Overwriting Prev would lose the original owner secret: resume.
      throw new ConvexError("ROTATION_IN_PROGRESS");
    }

    const byUser = (table: "vault_categories" | "folders") =>
      ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    await resealNames(
      ctx,
      await byUser("vault_categories"),
      args.categoryNames,
    );
    await resealNames(ctx, await byUser("folders"), args.folderNames);

    for (const pin of args.contactPins) {
      const contact = await ctx.db.get(pin.contactId);
      if (!contact || contact.userId !== userId) {
        throw new Error("Contact not found");
      }
      // Rotation re-MACs a pin; it never changes the pinned identity.
      if (
        contact.pinnedIdentityFingerprint &&
        contact.pinnedIdentityFingerprint !== pin.fingerprint
      ) {
        throw new Error("Contact identity is already pinned");
      }
      await ctx.db.patch(pin.contactId, {
        pinnedIdentityFingerprint: pin.fingerprint,
        pinnedIdentityMac: pin.mac,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(userId, {
      encryptedKeyBundle: args.encryptedKeyBundle,
      publicKey: args.publicKey,
      publicKeySignature: args.publicKeySignature,
      identityPublicKey: args.identityPublicKey,
      encryptedIdentitySecretKey: args.encryptedIdentitySecretKey,
      encryptedAsymmetricSecretKey: args.encryptedAsymmetricSecretKey,
      encryptedAsymmetricSecretKeyPrev: args.encryptedAsymmetricSecretKeyPrev,
      encryptedRetiredSecretKeys: args.encryptedRetiredSecretKeys,
      updatedAt: Date.now(),
    });
    // Where this user is someone's trusted contact, the owner wraps to the
    // key on their row: publish the new one, so owners review the identity
    // change instead of sealing to the retired key.
    await publishContactKeyToOwnerRows(ctx, userId, {
      contactPublicKey: args.publicKey,
      contactIdentityPublicKey: args.identityPublicKey,
      contactPublicKeySignature: args.publicKeySignature,
    });
    // Other devices hold the old MasterKey: sign them out so none keeps
    // sealing to the old key or syncing the vault. They open it again with
    // the new key (cloud backup, 24 words or a QR link).
    const sessionsEnded = await endSessions(
      ctx,
      userId,
      await getAuthSessionId(ctx),
    );
    return { success: true, sessionsEnded };
  },
});

/**
 * Close the rotation once the phone saw every item wrapped to the new key:
 * archive the previous secret (never dropped, see `encryptedRetiredSecretKeys`)
 * and retire the old RootKey with a new kit, so a device, envelope or paper
 * kit holding the old 24 words' RootKey opens nothing. Also satisfies a forced
 * rotation (`masterKeyRotationRequired`).
 */
export const finalizeRotation = auditedMutation({
  action: "vault.rotation_finalized",
  resourceType: "user",
  args: {
    // The archive with the previous secret added, under the current key.
    encryptedRetiredSecretKeys: v.string(),
    // New kit for the current master key (new words, salt and RootKey).
    encryptedKeyBundle: v.string(),
    phraseSalt: v.string(),
    recoveryPhraseHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVaultProvenAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.encryptedAsymmetricSecretKeyPrev) {
      throw new ConvexError("NO_ROTATION_IN_PROGRESS");
    }
    // The social envelope seals the previous MasterKey: renew it.
    const socialSetup = await ctx.db
      .query("social_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    await ctx.db.patch(userId, {
      encryptedAsymmetricSecretKeyPrev: undefined,
      encryptedRetiredSecretKeys: args.encryptedRetiredSecretKeys,
      encryptedKeyBundle: args.encryptedKeyBundle,
      phraseSalt: args.phraseSalt,
      recoveryPhraseHash: args.recoveryPhraseHash,
      // Derived from the old words, which must stop working everywhere.
      totpResetVerifierHash: undefined,
      masterKeyRotationRequired: undefined,
      ...(socialSetup ? { socialRecoveryRenewalRequired: true } : {}),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Every item the owner holds, regardless of status. Rotation must re-wrap
 * ALL of them — archived/sealed items still carry wraps to the old keys, so
 * the owner-facing `getItems` (active-only) filter is too narrow here.
 */
export const getRotatableItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    return await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * For one of the owner's items, the contacts that currently hold a wrapped DEK
 * plus their public key — so the rotation orchestrator can re-wrap the DEK
 * to the same recipient set. Contacts without a published key are omitted (they
 * could not have been wrapped to anyway).
 */
export const getItemRecipients = query({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) return [];

    const rows = await ctx.db
      .query("vault_item_recipient_keys")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    const result: Array<{
      contactId: Id<"trusted_contacts">;
      contactUserId?: Id<"users">;
      contactPublicKey: string;
      // Identity material for verify-before-wrap (finding #2). These are the
      // owner's own rows, so the pin (if any) travels with them.
      contactIdentityPublicKey?: string;
      contactPublicKeySignature?: string;
      pinnedIdentityFingerprint?: string;
      pinnedIdentityMac?: string;
      // Every recipient here holds a wrap of this item.
      hasWraps: true;
    }> = [];
    for (const row of rows) {
      const contact = await ctx.db.get(row.contactId);
      if (contact && contact.userId === userId && contact.contactPublicKey) {
        result.push({
          contactId: row.contactId,
          contactUserId: contact.contactUserId,
          contactPublicKey: contact.contactPublicKey,
          contactIdentityPublicKey: contact.contactIdentityPublicKey,
          contactPublicKeySignature: contact.contactPublicKeySignature,
          pinnedIdentityFingerprint: contact.pinnedIdentityFingerprint,
          pinnedIdentityMac: contact.pinnedIdentityMac,
          hasWraps: true,
        });
      }
    }
    return result;
  },
});
