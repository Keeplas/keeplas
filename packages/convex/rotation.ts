import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireFullAuth } from "./helpers";
import { auditedMutation } from "./audit";

/**
 * Master-key rotation (return-after-release flow). When a vault owner comes
 * back AFTER an emergency release fired, the leaked master key / owner keypair
 * must be retired so anything they change going forward is safe again. The
 * heavy lifting (generating new keys, re-encrypting every item) happens
 * client-side; these mutations persist the new key material and gate the
 * transitional read-fallback window.
 *
 * Crash-safety invariant: at every committed state, unlocking with the phrase
 * yields a master key that can read EVERY item. `rotateKeyMaterial` swaps the
 * user-level key material atomically and keeps the PREVIOUS owner secret key
 * (re-wrapped under the new master key) so not-yet-migrated items remain
 * readable. `finalizeRotation` drops it once the per-item re-encryption loop
 * has migrated everything.
 */

/**
 * Atomically swap the user's key material to a freshly generated master key
 * and owner ML-KEM keypair. Unlike `users.setPublicKey`, this deliberately
 * OVERWRITES an existing public key — rotation is the one place that must.
 */
export const rotateKeyMaterial = auditedMutation({
  action: "vault.key_material_rotated",
  resourceType: "user",
  args: {
    // New v2 bundle: the new master key wrapped under the (unchanged) RootKey.
    encryptedKeyBundle: v.string(),
    // New owner ML-KEM public key.
    publicKey: v.string(),
    // New ML-DSA signature over the new ML-KEM public-key bytes (finding #2).
    // Rotation changes `publicKey`, so the old signature would be stale —
    // contacts verify-before-wrap against this, so it must be re-signed
    // atomically with the new key, never left dangling.
    publicKeySignature: v.string(),
    // New owner secret key, AES-GCM wrapped under the NEW master key.
    encryptedAsymmetricSecretKey: v.string(),
    // OLD owner secret key, AES-GCM wrapped under the NEW master key — keeps
    // pre-rotation items readable until they are re-encrypted.
    encryptedAsymmetricSecretKeyPrev: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    await ctx.db.patch(userId, {
      encryptedKeyBundle: args.encryptedKeyBundle,
      publicKey: args.publicKey,
      publicKeySignature: args.publicKeySignature,
      encryptedAsymmetricSecretKey: args.encryptedAsymmetricSecretKey,
      encryptedAsymmetricSecretKeyPrev: args.encryptedAsymmetricSecretKeyPrev,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Close the rotation: every item is now wrapped under the new keypair, so the
 * transitional previous secret key can be discarded.
 */
export const finalizeRotation = auditedMutation({
  action: "vault.rotation_finalized",
  resourceType: "user",
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    await ctx.db.patch(userId, {
      encryptedAsymmetricSecretKeyPrev: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Every item the owner holds, regardless of status. Rotation must re-encrypt
 * ALL of them — archived/sealed items still carry ciphertext under the old
 * keys, so the owner-facing `getItems` (active-only) filter is too narrow here.
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
 * plus their public key — so the rotation orchestrator can re-wrap the new DEK
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
      contactPublicKey: string;
      // Identity material for verify-before-wrap (finding #2). These are the
      // owner's own rows, so the pin (if any) travels with them.
      contactIdentityPublicKey?: string;
      contactPublicKeySignature?: string;
      pinnedIdentityFingerprint?: string;
    }> = [];
    for (const row of rows) {
      const contact = await ctx.db.get(row.contactId);
      if (contact && contact.userId === userId && contact.contactPublicKey) {
        result.push({
          contactId: row.contactId,
          contactPublicKey: contact.contactPublicKey,
          contactIdentityPublicKey: contact.contactIdentityPublicKey,
          contactPublicKeySignature: contact.contactPublicKeySignature,
          pinnedIdentityFingerprint: contact.pinnedIdentityFingerprint,
        });
      }
    }
    return result;
  },
});
