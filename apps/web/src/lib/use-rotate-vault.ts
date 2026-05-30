"use client";

import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { deriveRootKey } from "@keeplas/crypto/kdf";
import { split } from "@keeplas/crypto/shamir";
import {
  generateRecipientKeyPair,
  serializePublicKey,
  serializeSecretKey,
  parseSecretKey,
  wrapDek,
  unwrapDek,
  wrapBytes,
} from "@keeplas/crypto/kem";
import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import { parsePublicKey } from "@keeplas/crypto/kem";
import { useMasterKey } from "./master-key-context";
import { useVaultCrypto } from "./use-vault-crypto";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useAuditedMutation } from "./use-audited-mutation";
import { verifyContactKey } from "./verify-contact-key";
import { STORAGE_KEYS } from "./storage-keys";

/**
 * Full master-key rotation for the "return after release" flow.
 *
 * When the owner comes back AFTER an emergency release fired, the leaked
 * material (master key via Shamir, owner secret key, released DEKs) must be
 * retired. This hook, driven from the client with the unlocked vault + the
 * 24-word phrase, regenerates the master key and owner ML-KEM keypair, then
 * re-encrypts every item under a fresh per-item DEK and re-wraps it to the
 * still-trusted recipients. It does NOT recover data a contact already
 * decrypted during the release — it makes everything going forward safe again.
 *
 * Crash-safety: `rotation.rotateKeyMaterial` keeps the previous owner secret
 * (re-wrapped under the new master key) so the vault stays fully readable while
 * items migrate one-by-one. A crashed run is resumed by calling `rotate` again:
 * already-migrated items are detected and skipped, and the key generation step
 * is bypassed when a rotation is already in flight.
 */
export type RotateStatus =
  | "idle"
  | "validating"
  | "rotating_keys"
  | "redistributing"
  | "reencrypting"
  | "finalizing"
  | "done"
  | "error";

export interface RotateProgress {
  done: number;
  total: number;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** AES-GCM wrap an ML-KEM secret key under a master key → JSON { ciphertext, iv }. */
async function wrapSecretUnderKey(
  secretKey: Uint8Array,
  masterKey: CryptoKey,
): Promise<string> {
  const data = new TextEncoder().encode(serializeSecretKey(secretKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    data,
  );
  return JSON.stringify({
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
    iv: uint8ToBase64(iv),
  });
}

/** Reverse of {@link wrapSecretUnderKey}. */
async function unwrapSecretUnderKey(
  bundle: string,
  masterKey: CryptoKey,
): Promise<Uint8Array> {
  const { ciphertext, iv } = JSON.parse(bundle) as {
    ciphertext: string;
    iv: string;
  };
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(iv) },
    masterKey,
    base64ToUint8(ciphertext),
  );
  return parseSecretKey(new TextDecoder().decode(plaintext));
}

/** Wrap a fresh master key under the RootKey into a v2 key bundle. */
async function buildKeyBundle(
  rawMasterKey: Uint8Array,
  rootKey: CryptoKey,
  phraseSaltB64: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Copy into a fresh ArrayBuffer-backed view so the strict BufferSource
  // overload accepts it (mirrors the crypto package's importAesKey).
  const buf = new Uint8Array(rawMasterKey.byteLength);
  buf.set(rawMasterKey);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    rootKey,
    buf,
  );
  return JSON.stringify({
    version: 2,
    phraseSalt: phraseSaltB64,
    iv: uint8ToBase64(iv),
    encryptedMasterKey: uint8ToBase64(new Uint8Array(wrapped)),
  });
}

export function useRotateVault() {
  const convex = useConvex();
  const { masterKey, setMasterKey } = useMasterKey();
  const { ensureOwnerKeypair, signWithIdentityKey } = useRecipientCrypto();
  const pinContactIdentity = useAuditedMutation(
    api.trusted_contacts.pinContactIdentity,
  );
  const {
    encryptContentWithKey,
    decryptContentWithKey,
    encryptBlobWithKey,
    decryptBlobWithKey,
  } = useVaultCrypto();

  const rotateKeyMaterial = useAuditedMutation(api.rotation.rotateKeyMaterial);
  const finalizeRotation = useAuditedMutation(api.rotation.finalizeRotation);
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const generateUploadUrl = useAuditedMutation(
    api.vault_items.generateUploadUrl,
  );
  const addItemFiles = useAuditedMutation(api.vault_items.addItemFiles);
  const removeItemFile = useAuditedMutation(api.vault_items.removeItemFile);
  const storeEncryptedShard = useAuditedMutation(
    api.trusted_contacts.storeEncryptedShard,
  );

  const [status, setStatus] = useState<RotateStatus>("idle");
  const [progress, setProgress] = useState<RotateProgress>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const postBlob = useCallback(
    async (url: string, blob: Blob): Promise<StorageRef> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: StorageRef };
      return storageId;
    },
    [],
  );

  /** Re-split the new master key and hand new shards to device/contacts. */
  const redistribute = useCallback(
    async (masterKey: CryptoKey, threshold: number) => {
      const rawMasterKey = new Uint8Array(
        await crypto.subtle.exportKey("raw", masterKey),
      );
      // 4 shares: device + 3 contacts. The server holds NO shard (finding #3).
      const shards = await split(rawMasterKey, 4, threshold);
      rawMasterKey.fill(0);
      try {
        localStorage.setItem(
          STORAGE_KEYS.deviceShard,
          uint8ToBase64(shards[0]),
        );
      } catch {
        // Private mode etc — non-fatal.
      }

      const targets = await convex.query(
        api.trusted_contacts.getDistributionTargets,
        {},
      );
      // storeEncryptedShard enforces a 2-contact floor; skip contact shards
      // when the trusted circle is too small (the device shard still rotates).
      if (targets.length >= 2) {
        for (const t of targets) {
          const slot = t.shardIndex - 1;
          if (slot < 0 || slot >= shards.length) continue;
          // Verify-before-wrap (finding #2): authenticate the contact's key and
          // honour the TOFU pin before handing them a shard. A failure throws
          // and aborts the rotation (surfaced via the rotate error state) — we
          // never wrap a shard to an unauthenticated / changed key.
          const outcome = await verifyContactKey(t);
          if (outcome.status !== "ok") {
            throw new Error(
              `Can't verify ${t.name}'s encryption key (${outcome.status}). Resolve this from your contacts before rotating.`,
            );
          }
          if (outcome.pinFingerprint) {
            await pinContactIdentity({
              contactId: t.contactId,
              fingerprint: outcome.pinFingerprint,
            });
          }
          const envelope = await wrapBytes(
            shards[slot],
            outcome.contactPublicKey,
          );
          await storeEncryptedShard({
            contactId: t.contactId,
            encryptedShard: envelope,
            shardPublicKeyUsed: outcome.contactPublicKey,
          });
        }
      }
    },
    [convex, storeEncryptedShard, pinContactIdentity],
  );

  /** Re-encrypt a single ZK item under a fresh DEK and re-wrap it. */
  const migrateItem = useCallback(
    async (
      item: {
        _id: Id<"vault_items">;
        encryptedContent: string;
        encryptedLinks?: string;
        ownerWrappedDek?: string;
      },
      keys: {
        oldOwnerSecret: Uint8Array;
        newOwnerSecret: Uint8Array;
        newOwnerPubB64: string;
      },
    ) => {
      const ownerWrappedDek = item.ownerWrappedDek!;

      // Resumability: if the item already unwraps with the new secret it was
      // migrated in a prior (crashed) run — leave it alone.
      try {
        await unwrapDek(ownerWrappedDek, keys.newOwnerSecret);
        return;
      } catch {
        // Not yet migrated — proceed.
      }

      const oldDek = await unwrapDek(ownerWrappedDek, keys.oldOwnerSecret);
      const newDek = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );

      const plainContent = await decryptContentWithKey(
        item.encryptedContent,
        oldDek,
      );
      const newContent = await encryptContentWithKey(plainContent, newDek);
      const newLinks = item.encryptedLinks
        ? await encryptContentWithKey(
            await decryptContentWithKey(item.encryptedLinks, oldDek),
            newDek,
          )
        : undefined;

      // Files: re-encrypt each blob under the new DEK and attach fresh rows
      // before dropping the old ones (add-then-remove never loses a file).
      const files = await convex.query(api.vault_items.getItemFiles, {
        itemId: item._id,
      });
      const newFileRows: Array<{
        storageId: StorageRef;
        name: string;
        mimeType: string;
        size: number;
        iv: string;
        kind: "document" | "audio" | "video" | "image";
        durationSec?: number;
      }> = [];
      for (const f of files) {
        const url = await convex.query(api.vault_items.getItemFileUrl, {
          fileId: f._id,
        });
        if (!url) continue;
        const cipherBlob = await (await fetch(url)).blob();
        let plainBlob: Blob;
        try {
          plainBlob = await decryptBlobWithKey(cipherBlob, f.iv, oldDek);
        } catch {
          // Not decryptable with the old DEK: an orphan blob left by a crashed
          // run (encrypted under that run's discarded DEK). Skip re-encrypting
          // it — it is still in `files` and gets removed after the switch below.
          continue;
        }
        const { cipherBlob: newCipher, iv: newIv } = await encryptBlobWithKey(
          plainBlob,
          newDek,
        );
        const storageId = await postBlob(await generateUploadUrl(), newCipher);
        newFileRows.push({
          storageId,
          name: f.name,
          mimeType: f.mimeType,
          size: newCipher.size,
          iv: newIv,
          kind: f.kind,
          durationSec: f.durationSec,
        });
      }
      if (newFileRows.length > 0) {
        await addItemFiles({ itemId: item._id, files: newFileRows });
      }

      // Re-wrap the new DEK to the owner + the same recipient set. Each
      // recipient's key is authenticated before wrapping (finding #2); a
      // failure throws and aborts the rotation.
      const recipients = await convex.query(api.rotation.getItemRecipients, {
        itemId: item._id,
      });
      const recipientKeys = await Promise.all(
        recipients.map(async (r) => {
          const outcome = await verifyContactKey(r);
          if (outcome.status !== "ok") {
            throw new Error(
              `Can't verify a recipient's encryption key (${outcome.status}) while re-wrapping. Resolve this from your contacts before rotating.`,
            );
          }
          if (outcome.pinFingerprint) {
            await pinContactIdentity({
              contactId: r.contactId,
              fingerprint: outcome.pinFingerprint,
            });
          }
          return {
            contactId: r.contactId,
            wrappedDek: await wrapDek(newDek, outcome.contactPublicKey),
          };
        }),
      );
      const ownerWrap = await wrapDek(newDek, keys.newOwnerPubB64);

      await updateItem({
        itemId: item._id,
        encryptedContent: newContent,
        encryptedLinks: newLinks,
        ownerWrappedDek: ownerWrap,
        recipientKeys,
      });

      // Switch is committed; drop the stale ciphertext blobs.
      for (const f of files) {
        await removeItemFile({ itemId: item._id, fileId: f._id });
      }
    },
    [
      convex,
      decryptContentWithKey,
      encryptContentWithKey,
      decryptBlobWithKey,
      encryptBlobWithKey,
      generateUploadUrl,
      addItemFiles,
      removeItemFile,
      updateItem,
      postBlob,
      pinContactIdentity,
    ],
  );

  const rotate = useCallback(
    async (phrase: string[]): Promise<boolean> => {
      setError(null);
      if (!masterKey) {
        setError("Unlock your vault before rotating.");
        setStatus("error");
        return false;
      }

      try {
        setStatus("validating");
        const viewer = await convex.query(api.users.viewer, {});
        if (!viewer?.phraseSalt || !viewer.encryptedKeyBundle) {
          throw new Error("Vault is not initialized.");
        }
        const phraseSaltB64 = viewer.phraseSalt;
        const rootKey = await deriveRootKey(
          phrase,
          base64ToUint8(phraseSaltB64),
          { extractable: false },
        );

        // Guard against bricking the bundle: the phrase MUST unwrap the current
        // bundle to the live master key before we re-wrap anything under it.
        const currentBundle = JSON.parse(viewer.encryptedKeyBundle) as {
          iv: string;
          encryptedMasterKey: string;
        };
        const unwrappedRaw = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToUint8(currentBundle.iv) },
            rootKey,
            base64ToUint8(currentBundle.encryptedMasterKey),
          ),
        );
        const liveRaw = new Uint8Array(
          await crypto.subtle.exportKey("raw", masterKey),
        );
        if (!bytesEqual(unwrappedRaw, liveRaw)) {
          liveRaw.fill(0);
          unwrappedRaw.fill(0);
          throw new Error("Recovery phrase does not match this vault.");
        }
        unwrappedRaw.fill(0);

        const items = await convex.query(api.rotation.getRotatableItems, {});
        const legacy = items.filter((i) => !i.ownerWrappedDek);
        if (legacy.length > 0) {
          throw new Error(
            `${legacy.length} legacy item(s) must be migrated to zero-knowledge encryption before rotation.`,
          );
        }

        const resuming = !!viewer.encryptedAsymmetricSecretKeyPrev;
        let newMasterKey: CryptoKey;
        let newOwnerPubB64: string;
        let newOwnerSecret: Uint8Array;
        let oldOwnerSecret: Uint8Array;

        if (resuming) {
          // Key material already swapped; the live master key IS the new one.
          newMasterKey = masterKey;
          newOwnerPubB64 = viewer.publicKey!;
          newOwnerSecret = await unwrapSecretUnderKey(
            viewer.encryptedAsymmetricSecretKey!,
            masterKey,
          );
          oldOwnerSecret = await unwrapSecretUnderKey(
            viewer.encryptedAsymmetricSecretKeyPrev!,
            masterKey,
          );
          liveRaw.fill(0);
        } else {
          // Capture the OLD owner secret while the viewer still holds it.
          const { secretKey: oldSec } = await ensureOwnerKeypair();
          oldOwnerSecret = oldSec;

          setStatus("rotating_keys");
          newMasterKey = await generateMasterKey();
          const rawNew = new Uint8Array(
            await crypto.subtle.exportKey("raw", newMasterKey),
          );
          const kp = generateRecipientKeyPair();
          newOwnerPubB64 = serializePublicKey(kp.publicKey);
          newOwnerSecret = kp.secretKey;

          // Re-sign the NEW ML-KEM public key with the (unchanged) identity
          // secret key (finding #2). Rotation changes `publicKey`, so the old
          // `publicKeySignature` is stale and would fail every contact's
          // verify-before-wrap. Persist the fresh signature atomically with the
          // new key in `rotateKeyMaterial`.
          const newPublicKeySignature = await signWithIdentityKey(
            parsePublicKey(newOwnerPubB64),
          );

          await rotateKeyMaterial({
            encryptedKeyBundle: await buildKeyBundle(
              rawNew,
              rootKey,
              phraseSaltB64,
            ),
            publicKey: newOwnerPubB64,
            publicKeySignature: newPublicKeySignature,
            encryptedAsymmetricSecretKey: await wrapSecretUnderKey(
              newOwnerSecret,
              newMasterKey,
            ),
            encryptedAsymmetricSecretKeyPrev: await wrapSecretUnderKey(
              oldOwnerSecret,
              newMasterKey,
            ),
          });
          rawNew.fill(0);
          liveRaw.fill(0);

          // Persist the new master key (memory + IndexedDB) so a refresh resumes.
          setMasterKey(newMasterKey);
        }

        // Re-split shards of the NEW master key. Runs in both modes: a crash
        // before this point leaves contacts holding stale OLD-key shards, so a
        // resumed run must (idempotently) redistribute too.
        setStatus("redistributing");
        await redistribute(newMasterKey, viewer.vaultThreshold ?? 2);

        setStatus("reencrypting");
        setProgress({ done: 0, total: items.length });
        for (let i = 0; i < items.length; i++) {
          await migrateItem(items[i], {
            oldOwnerSecret,
            newOwnerSecret,
            newOwnerPubB64,
          });
          setProgress({ done: i + 1, total: items.length });
        }

        setStatus("finalizing");
        await finalizeRotation({});
        setStatus("done");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
        return false;
      }
    },
    [
      masterKey,
      convex,
      ensureOwnerKeypair,
      signWithIdentityKey,
      rotateKeyMaterial,
      setMasterKey,
      redistribute,
      migrateItem,
      finalizeRotation,
    ],
  );

  return { rotate, status, progress, error };
}
