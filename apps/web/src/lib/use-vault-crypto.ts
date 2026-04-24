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
        data
      );

      const payload: EncryptedPayload = {
        ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(iv),
      };

      return JSON.stringify(payload);
    },
    []
  );

  /**
   * Encrypt plaintext content using the user's master key.
   */
  const encryptContent = useCallback(
    async (plaintext: string): Promise<string> => {
      if (!masterKey) throw new Error("Master Key not available");
      return await encryptContentWithKey(plaintext, masterKey);
    },
    [masterKey, encryptContentWithKey]
  );

  /**
   * Decrypt stored content back to plaintext.
   * Expects the JSON string format from encryptContent.
   */
  const decryptContent = useCallback(
    async (encryptedJson: string): Promise<string> => {
      if (!masterKey) throw new Error("Master Key not available");

      const payload: EncryptedPayload = JSON.parse(encryptedJson);
      const ciphertext = base64ToUint8(payload.ciphertext);
      const iv = base64ToUint8(payload.iv);

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        masterKey,
        ciphertext
      );

      return new TextDecoder().decode(plaintext);
    },
    [masterKey]
  );

  /**
   * Compute SHA-256 hash of plaintext for integrity verification.
   */
  const computeHash = useCallback(async (plaintext: string): Promise<string> => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(plaintext)
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }, []);

  /**
   * Encrypt a Blob with the given AES-GCM key. Small blobs use a single
   * AES-GCM call; larger payloads fall back to chunked streaming.
   */
  const encryptBlobWithKey = useCallback(
    async (
      blob: Blob,
      key: CryptoKey
    ): Promise<{ cipherBlob: Blob; iv: string }> => {
      if (blob.size <= STREAM_THRESHOLD_BYTES) {
        const buf = await blob.arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          buf
        );
        return {
          cipherBlob: new Blob([ciphertext]),
          iv: uint8ToBase64(iv),
        };
      }

      const { cipherBlob } = await encryptStream(blob, key);
      return { cipherBlob, iv: STREAM_IV_SENTINEL };
    },
    []
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
    [masterKey, encryptBlobWithKey]
  );

  /**
   * Decrypt a Blob produced by {@link encryptBlob}. The IV value carries
   * the dispatch: a sentinel "__stream__" means chunked, otherwise base64 IV
   * is used for single-shot decryption.
   */
  const decryptBlob = useCallback(
    async (cipherBlob: Blob, iv: string): Promise<Blob> => {
      if (!masterKey) throw new Error("Master Key not available");

      if (iv === STREAM_IV_SENTINEL) {
        return await decryptStream(cipherBlob, masterKey);
      }

      const ivBytes = base64ToUint8(iv);
      const cipherBuf = await cipherBlob.arrayBuffer();
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        masterKey,
        cipherBuf
      );
      return new Blob([plaintext]);
    },
    [masterKey]
  );

  return {
    encryptContent,
    encryptContentWithKey,
    decryptContent,
    encryptBlob,
    encryptBlobWithKey,
    decryptBlob,
    computeHash,
    isReady: masterKey !== null,
  };
}
