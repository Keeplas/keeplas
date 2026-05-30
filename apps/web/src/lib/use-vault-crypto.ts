"use client";

import { useCallback } from "react";
import { useMasterKey } from "./master-key-context";
import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import { encryptStream, decryptStream } from "@keeplas/crypto";

interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

const STREAM_THRESHOLD_BYTES = 8 * 1024 * 1024; // 8 MB
const STREAM_IV_SENTINEL = "__stream__";

/**
 * Hook providing encrypt/decrypt functions for vault item content.
 * Uses the Master Key held in memory.
 */
export function useVaultCrypto() {
  const { masterKey } = useMasterKey();

  /**
   * Encrypt plaintext content with the given AES-GCM key. Returns a JSON
   * string containing base64-encoded ciphertext + IV.
   */
  const encryptContentWithKey = useCallback(
    async (plaintext: string, key: CryptoKey): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data,
      );

      const payload: EncryptedPayload = {
        ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(iv),
      };

      return JSON.stringify(payload);
    },
    [],
  );

  /**
   * Encrypt plaintext content using the user's master key.
   */
  const encryptContent = useCallback(
    async (plaintext: string): Promise<string> => {
      if (!masterKey) throw new Error("Master Key not available");
      return await encryptContentWithKey(plaintext, masterKey);
    },
    [masterKey, encryptContentWithKey],
  );

  /**
   * Decrypt stored content back to plaintext using a caller-provided key
   * (e.g., a per-item DEK unwrapped from `ownerWrappedDek`).
   */
  const decryptContentWithKey = useCallback(
    async (encryptedJson: string, key: CryptoKey): Promise<string> => {
      const payload: EncryptedPayload = JSON.parse(encryptedJson);
      const ciphertext = base64ToUint8(payload.ciphertext);
      const iv = base64ToUint8(payload.iv);

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );

      return new TextDecoder().decode(plaintext);
    },
    [],
  );

  /**
   * Decrypt stored content back to plaintext using the user's master key.
   * Used for legacy `aes_256_gcm` items only; ZK items go through
   * `decryptContentWithKey` with the unwrapped DEK.
   */
  const decryptContent = useCallback(
    async (encryptedJson: string): Promise<string> => {
      if (!masterKey) throw new Error("Master Key not available");
      return await decryptContentWithKey(encryptedJson, masterKey);
    },
    [masterKey, decryptContentWithKey],
  );

  /**
   * Encrypt a Blob with the given AES-GCM key. Small blobs use a single
   * AES-GCM call; larger payloads fall back to chunked streaming.
   */
  const encryptBlobWithKey = useCallback(
    async (
      blob: Blob,
      key: CryptoKey,
    ): Promise<{ cipherBlob: Blob; iv: string }> => {
      if (blob.size <= STREAM_THRESHOLD_BYTES) {
        const buf = await blob.arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          buf,
        );
        return {
          cipherBlob: new Blob([ciphertext]),
          iv: uint8ToBase64(iv),
        };
      }

      const { cipherBlob } = await encryptStream(blob, key);
      return { cipherBlob, iv: STREAM_IV_SENTINEL };
    },
    [],
  );

  /**
   * Encrypt an arbitrary Blob for upload to Convex storage with the
   * user's master key.
   */
  const encryptBlob = useCallback(
    async (blob: Blob): Promise<{ cipherBlob: Blob; iv: string }> => {
      if (!masterKey) throw new Error("Master Key not available");
      return await encryptBlobWithKey(blob, masterKey);
    },
    [masterKey, encryptBlobWithKey],
  );

  /**
   * Decrypt a Blob with a caller-provided AES-GCM key. The IV value carries
   * the dispatch: a sentinel "__stream__" means chunked, otherwise base64 IV
   * is used for single-shot decryption.
   */
  const decryptBlobWithKey = useCallback(
    async (cipherBlob: Blob, iv: string, key: CryptoKey): Promise<Blob> => {
      if (iv === STREAM_IV_SENTINEL) {
        return await decryptStream(cipherBlob, key);
      }

      const ivBytes = base64ToUint8(iv);
      const cipherBuf = await cipherBlob.arrayBuffer();
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        key,
        cipherBuf,
      );
      return new Blob([plaintext]);
    },
    [],
  );

  /**
   * Decrypt a Blob produced by {@link encryptBlob} under the master key.
   * Used for legacy `aes_256_gcm` attachments only.
   */
  const decryptBlob = useCallback(
    async (cipherBlob: Blob, iv: string): Promise<Blob> => {
      if (!masterKey) throw new Error("Master Key not available");
      return await decryptBlobWithKey(cipherBlob, iv, masterKey);
    },
    [masterKey, decryptBlobWithKey],
  );

  return {
    encryptContent,
    encryptContentWithKey,
    decryptContent,
    decryptContentWithKey,
    encryptBlob,
    encryptBlobWithKey,
    decryptBlob,
    decryptBlobWithKey,
    isReady: masterKey !== null,
  };
}
