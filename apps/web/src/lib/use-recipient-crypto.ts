"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  generateRecipientKeyPair,
  parseSecretKey,
  serializePublicKey,
  serializeSecretKey,
  unwrapDek,
  wrapDek,
} from "@keeplas/crypto/kem";
import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import { useMasterKey } from "./master-key-context";

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
  const setPublicKey = useMutation(api.users.setPublicKey);

  const ownerSecretKeyRef = useRef<Uint8Array | null>(null);
  const ownerPublicKeyB64Ref = useRef<string | null>(null);

  const ensureOwnerKeypair = useCallback(async (): Promise<{
    publicKeyB64: string;
    secretKey: Uint8Array;
  }> => {
    if (!masterKey) throw new Error("Master Key not available");
    if (!viewer) throw new Error("Viewer not loaded");

    if (ownerPublicKeyB64Ref.current && ownerSecretKeyRef.current) {
      return {
        publicKeyB64: ownerPublicKeyB64Ref.current,
        secretKey: ownerSecretKeyRef.current,
      };
    }

    if (viewer.publicKey && viewer.encryptedAsymmetricSecretKey) {
      const bundle = JSON.parse(viewer.encryptedAsymmetricSecretKey) as {
        ciphertext: string;
        iv: string;
      };
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8(bundle.iv) },
        masterKey,
        base64ToUint8(bundle.ciphertext)
      );
      const secretKeyB64 = new TextDecoder().decode(plaintext);
      const secretKey = parseSecretKey(secretKeyB64);

      ownerPublicKeyB64Ref.current = viewer.publicKey;
      ownerSecretKeyRef.current = secretKey;
      return { publicKeyB64: viewer.publicKey, secretKey };
    }

    const { publicKey, secretKey } = generateRecipientKeyPair();
    const publicKeyB64 = serializePublicKey(publicKey);
    const secretKeyB64 = serializeSecretKey(secretKey);
    const skBytes = new TextEncoder().encode(secretKeyB64);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const skBuf = new Uint8Array(skBytes.byteLength);
    skBuf.set(skBytes);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      masterKey,
      skBuf
    );
    const encryptedAsymmetricSecretKey = JSON.stringify({
      ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
      iv: uint8ToBase64(iv),
    });

    await setPublicKey({
      publicKey: publicKeyB64,
      encryptedAsymmetricSecretKey,
    });

    ownerPublicKeyB64Ref.current = publicKeyB64;
    ownerSecretKeyRef.current = secretKey;
    return { publicKeyB64, secretKey };
  }, [masterKey, viewer, setPublicKey]);

  /**
   * Generate a fresh DEK and return:
   *   - the DEK itself (use it to AES-GCM encrypt the content / files),
   *   - the owner's wrapped copy (so the owner can read the item back),
   *   - one wrapped copy per recipient that has a contactPublicKey set.
   * Recipients without a contactPublicKey are silently skipped — they
   * cannot decrypt the item until they re-accept their invitation with
   * a published key. Caller should detect & warn the user.
   */
  const generateDekAndWrap = useCallback(
    async (
      recipients: Array<{ contactId: string; contactPublicKey?: string }>
    ): Promise<{
      dek: CryptoKey;
      ownerWrap: WrappedDek;
      recipientWraps: RecipientWrap[];
      skippedRecipientIds: string[];
    }> => {
      const { publicKeyB64: ownerPublicB64 } = await ensureOwnerKeypair();

      const dek = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const ownerEnvelope = await wrapDek(dek, ownerPublicB64);
      const ownerWrap: WrappedDek = { wrappedDek: ownerEnvelope };

      const recipientWraps: RecipientWrap[] = [];
      const skippedRecipientIds: string[] = [];
      for (const r of recipients) {
        if (!r.contactPublicKey) {
          skippedRecipientIds.push(r.contactId);
          continue;
        }
        try {
          const envelope = await wrapDek(dek, r.contactPublicKey);
          recipientWraps.push({
            contactId: r.contactId,
            wrappedDek: envelope,
          });
        } catch {
          skippedRecipientIds.push(r.contactId);
        }
      }

      return { dek, ownerWrap, recipientWraps, skippedRecipientIds };
    },
    [ensureOwnerKeypair]
  );

  const unwrapOwnerDek = useCallback(
    async (wrap: WrappedDek): Promise<CryptoKey> => {
      const { secretKey } = await ensureOwnerKeypair();
      // unwrapDek already returns an extractable key suitable for re-wrap.
      return unwrapDek(wrap.wrappedDek, secretKey);
    },
    [ensureOwnerKeypair]
  );

  /**
   * Wrap an already-known DEK (e.g., recovered from an existing item via
   * {@link unwrapOwnerDek}) for a new recipient set. Returns a fresh
   * owner wrap + per-recipient wraps. Reuses the same DEK so previously
   * uploaded files stay decryptable.
   */
  const wrapExistingDek = useCallback(
    async (
      dek: CryptoKey,
      recipients: Array<{ contactId: string; contactPublicKey?: string }>
    ): Promise<{
      ownerWrap: WrappedDek;
      recipientWraps: RecipientWrap[];
      skippedRecipientIds: string[];
    }> => {
      const { publicKeyB64: ownerPublicB64 } = await ensureOwnerKeypair();
      const ownerWrap: WrappedDek = {
        wrappedDek: await wrapDek(dek, ownerPublicB64),
      };

      const recipientWraps: RecipientWrap[] = [];
      const skippedRecipientIds: string[] = [];
      for (const r of recipients) {
        if (!r.contactPublicKey) {
          skippedRecipientIds.push(r.contactId);
          continue;
        }
        try {
          const envelope = await wrapDek(dek, r.contactPublicKey);
          recipientWraps.push({
            contactId: r.contactId,
            wrappedDek: envelope,
          });
        } catch {
          skippedRecipientIds.push(r.contactId);
        }
      }

      return { ownerWrap, recipientWraps, skippedRecipientIds };
    },
    [ensureOwnerKeypair]
  );

  return {
    isReady: viewer !== undefined && masterKey !== null,
    generateDekAndWrap,
    wrapExistingDek,
    unwrapOwnerDek,
    ensureOwnerKeypair,
  };
}
