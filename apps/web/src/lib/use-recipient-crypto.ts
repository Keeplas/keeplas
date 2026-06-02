import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  generateRecipientKeyPair,
  parsePublicKey,
  parseSecretKey,
  serializePublicKey,
  serializeSecretKey,
  unwrapDek,
  wrapDek,
} from "@keeplas/crypto/kem";
import { generateIdentityKeyPair, signBytes } from "@keeplas/crypto/sig";
import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import { useMasterKey } from "./master-key-context";
import { readInMemorySecrets, setInMemorySecrets } from "./in-memory-secrets";
import { useAuditedMutation } from "./use-audited-mutation";
import {
  verifyContactKey,
  type ContactKeyMaterial,
  type BlockedContact,
} from "./verify-contact-key";
import type { Id } from "@keeplas/backend/_generated/dataModel";

/**
 * Wrapped DEK envelope. With ML-KEM-768, everything (KEM ciphertext, AES-GCM
 * IV, ciphertext) is packed inside a single JSON string — no separate IV
 * field. The legacy `wrappedDekIv` server field is kept optional for
 * backward-compat but is no longer written.
 */
export interface WrappedDek {
  wrappedDek: string;
}

interface RecipientWrap extends WrappedDek {
  contactId: string;
}

/**
 * Recipient passed to the wrap helpers. Carries the server-provided key
 * material so each wrap can be authenticated before it happens (finding #2).
 * `contactPublicKey` stays optional: a recipient that never published a key is
 * blocked as `unverifiable`, not silently skipped.
 */
export type WrapRecipient = ContactKeyMaterial;

/** JSON shape of a secret key wrapped under the MasterKey (AES-GCM). */
interface WrappedSecret {
  ciphertext: string;
  iv: string;
}

/**
 * AES-GCM wrap a base64 secret string under the MasterKey. Shared by the
 * ML-KEM secret key and the ML-DSA identity secret key so neither leaves the
 * client unencrypted, and the wrap format stays identical.
 */
async function wrapSecretB64UnderMasterKey(
  secretB64: string,
  masterKey: CryptoKey,
): Promise<string> {
  const skBytes = new TextEncoder().encode(secretB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const skBuf = new Uint8Array(skBytes.byteLength);
  skBuf.set(skBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    skBuf,
  );
  const bundle: WrappedSecret = {
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
    iv: uint8ToBase64(iv),
  };
  return JSON.stringify(bundle);
}

/** Inverse of {@link wrapSecretB64UnderMasterKey}: returns the base64 secret. */
async function unwrapSecretB64UnderMasterKey(
  wrapped: string,
  masterKey: CryptoKey,
): Promise<string> {
  const bundle = JSON.parse(wrapped) as WrappedSecret;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(bundle.iv) },
    masterKey,
    base64ToUint8(bundle.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Per-recipient DEK wrapping. Lazily generates the user's ML-KEM-768
 * keypair on first need and persists it (public key cleartext, secret
 * key encrypted under the master key, in `users.encryptedAsymmetricSecretKey`).
 *
 * The wrap envelope embeds:
 *  - the ML-KEM-768 KEM ciphertext (base64),
 *  - the AES-GCM IV (base64),
 *  - the AES-GCM-encrypted DEK (base64),
 * all under a single JSON string ready to land in `vault_items.ownerWrappedDek`
 * or `vault_item_recipient_keys.wrappedDek`.
 */
export function useRecipientCrypto() {
  const { masterKey } = useMasterKey();
  const viewer = useQuery(api.users.viewer);
  const setPublicKey = useAuditedMutation(api.users.setPublicKey);
  const pinContactIdentity = useAuditedMutation(
    api.trusted_contacts.pinContactIdentity,
  );

  // Decrypted secret material lives in a module-scoped holder (not local
  // useRefs) so the vault lock chokepoint can wipe it on auto-lock / sign-out.
  // Fields: ownerSecretKey (ML-KEM), ownerPublicKeyB64, ownerIdentitySecretKeyB64
  // (ML-DSA-65, for sign/verify), ownerPrevSecretKey (set only mid-rotation to
  // read items not yet re-encrypted; see rotation.ts).

  const ensureOwnerKeypair = useCallback(async (): Promise<{
    publicKeyB64: string;
    secretKey: Uint8Array;
  }> => {
    if (!masterKey) throw new Error("Master Key not available");
    if (!viewer) throw new Error("Viewer not loaded");

    const cached = readInMemorySecrets();
    if (cached.ownerPublicKeyB64 && cached.ownerSecretKey) {
      return {
        publicKeyB64: cached.ownerPublicKeyB64,
        secretKey: cached.ownerSecretKey,
      };
    }

    if (viewer.publicKey && viewer.encryptedAsymmetricSecretKey) {
      const secretKeyB64 = await unwrapSecretB64UnderMasterKey(
        viewer.encryptedAsymmetricSecretKey,
        masterKey,
      );
      const secretKey = parseSecretKey(secretKeyB64);

      // Unwrap the identity secret key in parallel, when present, into the same
      // in-memory holder so step 2 can sign/verify. Older accounts created
      // before identity keys existed simply have nothing to unwrap.
      if (viewer.encryptedIdentitySecretKey) {
        setInMemorySecrets({
          ownerIdentitySecretKeyB64: await unwrapSecretB64UnderMasterKey(
            viewer.encryptedIdentitySecretKey,
            masterKey,
          ),
        });
      }

      setInMemorySecrets({
        ownerPublicKeyB64: viewer.publicKey,
        ownerSecretKey: secretKey,
      });
      return { publicKeyB64: viewer.publicKey, secretKey };
    }

    // First time: generate the ML-KEM encryption keypair AND the ML-DSA
    // identity keypair, wrap both secret keys under the master key, sign the
    // ML-KEM public key with the identity key to bind it, then publish.
    const { publicKey, secretKey } = generateRecipientKeyPair();
    const publicKeyB64 = serializePublicKey(publicKey);
    const secretKeyB64 = serializeSecretKey(secretKey);
    const encryptedAsymmetricSecretKey = await wrapSecretB64UnderMasterKey(
      secretKeyB64,
      masterKey,
    );

    const identity = generateIdentityKeyPair();
    const encryptedIdentitySecretKey = await wrapSecretB64UnderMasterKey(
      identity.secretKey,
      masterKey,
    );
    // Sign the raw ML-KEM public-key bytes so verifiers can detect a
    // server-substituted encryption key (step 2 enforces this).
    const publicKeySignature = signBytes(
      identity.secretKey,
      parsePublicKey(publicKeyB64),
    );

    await setPublicKey({
      publicKey: publicKeyB64,
      encryptedAsymmetricSecretKey,
      identityPublicKey: identity.publicKey,
      encryptedIdentitySecretKey,
      publicKeySignature,
    });

    setInMemorySecrets({
      ownerPublicKeyB64: publicKeyB64,
      ownerSecretKey: secretKey,
      ownerIdentitySecretKeyB64: identity.secretKey,
    });
    return { publicKeyB64, secretKey };
  }, [masterKey, viewer, setPublicKey]);

  /**
   * Verify EVERY recipient's encryption key before wrapping (finding #2). For
   * each recipient: authenticate the ML-KEM key via the contact's identity
   * signature and TOFU pin. Only on success do we wrap the DEK to it. A
   * recipient that fails verification is reported in `blocked` — never silently
   * skipped — so the caller can raise a blocking alert. On first successful
   * verify (no pin yet) the contact's fingerprint is pinned via an audited
   * mutation, establishing trust-on-first-use.
   *
   * Shared by {@link generateDekAndWrap} and {@link wrapExistingDek} so the
   * verify-before-wrap gate has a single implementation.
   */
  const wrapDekToRecipients = useCallback(
    async (
      dek: CryptoKey,
      recipients: WrapRecipient[],
    ): Promise<{
      recipientWraps: RecipientWrap[];
      blocked: BlockedContact[];
    }> => {
      const recipientWraps: RecipientWrap[] = [];
      const blocked: BlockedContact[] = [];
      for (const r of recipients) {
        const outcome = await verifyContactKey(r);
        if (outcome.status !== "ok") {
          blocked.push({
            contactId: r.contactId,
            name: r.name,
            reason: outcome.status,
            newFingerprint:
              outcome.status === "fingerprint_changed"
                ? outcome.newFingerprint
                : undefined,
          });
          continue;
        }
        // First-trust: persist the pin before treating the wrap as final.
        if (outcome.pinFingerprint) {
          await pinContactIdentity({
            contactId: r.contactId as Id<"trusted_contacts">,
            fingerprint: outcome.pinFingerprint,
          });
        }
        recipientWraps.push({
          contactId: r.contactId,
          wrappedDek: await wrapDek(dek, outcome.contactPublicKey),
        });
      }
      return { recipientWraps, blocked };
    },
    [pinContactIdentity],
  );

  /**
   * Generate a fresh DEK and return:
   *   - the DEK itself (use it to AES-GCM encrypt the content / files),
   *   - the owner's wrapped copy (so the owner can read the item back),
   *   - one wrapped copy per VERIFIED recipient.
   * Recipients whose key cannot be authenticated are returned in `blocked`
   * (never silently skipped) so the caller can BLOCK the save and alert the
   * owner about possible server tampering / a contact that must re-key.
   */
  const generateDekAndWrap = useCallback(
    async (
      recipients: WrapRecipient[],
    ): Promise<{
      dek: CryptoKey;
      ownerWrap: WrappedDek;
      recipientWraps: RecipientWrap[];
      blocked: BlockedContact[];
    }> => {
      const { publicKeyB64: ownerPublicB64 } = await ensureOwnerKeypair();

      const dek = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );

      const ownerEnvelope = await wrapDek(dek, ownerPublicB64);
      const ownerWrap: WrappedDek = { wrappedDek: ownerEnvelope };

      const { recipientWraps, blocked } = await wrapDekToRecipients(
        dek,
        recipients,
      );

      return { dek, ownerWrap, recipientWraps, blocked };
    },
    [ensureOwnerKeypair, wrapDekToRecipients],
  );

  /**
   * Decrypt and cache the previous owner secret key during a rotation. Returns
   * null when no rotation is in flight. The previous secret is wrapped under
   * the CURRENT (new) master key, so the live masterKey unwraps it.
   */
  const loadPrevSecretKey =
    useCallback(async (): Promise<Uint8Array | null> => {
      const cachedPrev = readInMemorySecrets().ownerPrevSecretKey;
      if (cachedPrev) return cachedPrev;
      if (!masterKey || !viewer?.encryptedAsymmetricSecretKeyPrev) return null;

      const secretKeyB64 = await unwrapSecretB64UnderMasterKey(
        viewer.encryptedAsymmetricSecretKeyPrev,
        masterKey,
      );
      const secretKey = parseSecretKey(secretKeyB64);
      setInMemorySecrets({ ownerPrevSecretKey: secretKey });
      return secretKey;
    }, [masterKey, viewer]);

  const unwrapOwnerDek = useCallback(
    async (wrap: WrappedDek): Promise<CryptoKey> => {
      const { secretKey } = await ensureOwnerKeypair();
      // unwrapDek already returns an extractable key suitable for re-wrap.
      try {
        return await unwrapDek(wrap.wrappedDek, secretKey);
      } catch (err) {
        // Mid-rotation: the item may still be wrapped to the previous keypair.
        const prev = await loadPrevSecretKey();
        if (prev) return await unwrapDek(wrap.wrappedDek, prev);
        throw err;
      }
    },
    [ensureOwnerKeypair, loadPrevSecretKey],
  );

  /**
   * Wrap an already-known DEK (e.g., recovered from an existing item via
   * {@link unwrapOwnerDek}) for a new recipient set. Returns a fresh
   * owner wrap + per-recipient wraps. Reuses the same DEK so previously
   * uploaded files stay decryptable. Recipients that fail verification are
   * returned in `blocked` (verify-before-wrap, finding #2).
   */
  const wrapExistingDek = useCallback(
    async (
      dek: CryptoKey,
      recipients: WrapRecipient[],
    ): Promise<{
      ownerWrap: WrappedDek;
      recipientWraps: RecipientWrap[];
      blocked: BlockedContact[];
    }> => {
      const { publicKeyB64: ownerPublicB64 } = await ensureOwnerKeypair();
      const ownerWrap: WrappedDek = {
        wrappedDek: await wrapDek(dek, ownerPublicB64),
      };

      const { recipientWraps, blocked } = await wrapDekToRecipients(
        dek,
        recipients,
      );

      return { ownerWrap, recipientWraps, blocked };
    },
    [ensureOwnerKeypair, wrapDekToRecipients],
  );

  /**
   * Sign arbitrary bytes with the owner's long-lived ML-DSA identity secret
   * key (finding #2). Used by the rotation flow to re-sign the NEW ML-KEM
   * public key so its `publicKeySignature` stays valid — the identity key
   * itself is NOT rotated, so the existing signature would otherwise be stale.
   * Ensures the keypair is unwrapped first.
   */
  const signWithIdentityKey = useCallback(
    async (message: Uint8Array): Promise<string> => {
      await ensureOwnerKeypair();
      const sk = readInMemorySecrets().ownerIdentitySecretKeyB64;
      if (!sk) {
        throw new Error("Identity key not available for signing");
      }
      return signBytes(sk, message);
    },
    [ensureOwnerKeypair],
  );

  return {
    isReady: viewer !== undefined && masterKey !== null,
    generateDekAndWrap,
    wrapExistingDek,
    unwrapOwnerDek,
    ensureOwnerKeypair,
    signWithIdentityKey,
  };
}
