"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  generateRsaKeypair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKeyJwk,
  importPrivateKeyJwk,
  wrapDek,
  unwrapDek,
  type WrappedDek,
} from "@keeplas/crypto";
import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import { useMasterKey } from "./master-key-context";

interface RecipientWrap extends WrappedDek {
  contactId: string;
}

/**
 * Per-recipient DEK wrapping. Lazily generates the user's RSA keypair on
 * first need and persists it (public key cleartext, private key encrypted
 * under the master key). Provides {@link wrapDekForRecipients} which
 * yields a list of `{ contactId, wrappedDek, wrappedDekIv }` rows ready
 * to ship to the `vault_items.createItem` mutation, plus the owner's own
 * wrapped DEK so the owner can decrypt the item later.
 */
export function useRecipientCrypto() {
  const { masterKey } = useMasterKey();
  const viewer = useQuery(api.users.viewer);
  const setPublicKey = useMutation(api.users.setPublicKey);

  const ownerPrivateKeyRef = useRef<CryptoKey | null>(null);
  const ownerPublicKeyRef = useRef<CryptoKey | null>(null);

  const ensureOwnerKeypair = useCallback(async (): Promise<{
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }> => {
    if (!masterKey) throw new Error("Master Key not available");
    if (!viewer) throw new Error("Viewer not loaded");

    if (ownerPublicKeyRef.current && ownerPrivateKeyRef.current) {
      return {
        publicKey: ownerPublicKeyRef.current,
        privateKey: ownerPrivateKeyRef.current,
      };
    }

    if (viewer.publicKey && viewer.encryptedKeyBundle) {
      const publicKey = await importPublicKey(viewer.publicKey);
      const bundle = JSON.parse(viewer.encryptedKeyBundle) as {
        ciphertext: string;
        iv: string;
      };
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8(bundle.iv) },
        masterKey,
        base64ToUint8(bundle.ciphertext)
      );
      const jwk = JSON.parse(new TextDecoder().decode(plaintext)) as JsonWebKey;
      const privateKey = await importPrivateKeyJwk(jwk);

      ownerPublicKeyRef.current = publicKey;
      ownerPrivateKeyRef.current = privateKey;
      return { publicKey, privateKey };
    }

    const keypair = await generateRsaKeypair();
    const publicSpki = await exportPublicKey(keypair.publicKey);
    const jwk = await exportPrivateKeyJwk(keypair.privateKey);
    const jwkBytes = new TextEncoder().encode(JSON.stringify(jwk));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      masterKey,
      jwkBytes
    );
    const encryptedPrivateKey = JSON.stringify({
      ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
      iv: uint8ToBase64(iv),
    });

    await setPublicKey({
      publicKey: publicSpki,
      encryptedPrivateKey,
    });

    ownerPublicKeyRef.current = keypair.publicKey;
    ownerPrivateKeyRef.current = keypair.privateKey;
    return { publicKey: keypair.publicKey, privateKey: keypair.privateKey };
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
      const { publicKey: ownerPublic } = await ensureOwnerKeypair();

      const dek = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const ownerWrap = await wrapDek(dek, ownerPublic);

      const recipientWraps: RecipientWrap[] = [];
      const skippedRecipientIds: string[] = [];
      for (const r of recipients) {
        if (!r.contactPublicKey) {
          skippedRecipientIds.push(r.contactId);
          continue;
        }
        try {
          const publicKey = await importPublicKey(r.contactPublicKey);
          const wrap = await wrapDek(dek, publicKey);
          recipientWraps.push({ contactId: r.contactId, ...wrap });
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
      const { privateKey } = await ensureOwnerKeypair();
      // unwrap returns a non-extractable key; we need extractable for
      // re-wrapping during edits, so re-import as extractable.
      const unwrapped = await unwrapDek(wrap, privateKey);
      const raw = await crypto.subtle.exportKey("raw", unwrapped);
      return await crypto.subtle.importKey(
        "raw",
        raw,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
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
      const { publicKey: ownerPublic } = await ensureOwnerKeypair();
      const ownerWrap = await wrapDek(dek, ownerPublic);

      const recipientWraps: RecipientWrap[] = [];
      const skippedRecipientIds: string[] = [];
      for (const r of recipients) {
        if (!r.contactPublicKey) {
          skippedRecipientIds.push(r.contactId);
          continue;
        }
        try {
          const publicKey = await importPublicKey(r.contactPublicKey);
          const wrap = await wrapDek(dek, publicKey);
          recipientWraps.push({ contactId: r.contactId, ...wrap });
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
