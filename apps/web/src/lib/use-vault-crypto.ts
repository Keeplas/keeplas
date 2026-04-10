"use client";

import { useCallback } from "react";
import { useMasterKey } from "./master-key-context";

interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hook providing encrypt/decrypt functions for vault item content.
 * Uses the Master Key held in memory.
 */
export function useVaultCrypto() {
  const { masterKey } = useMasterKey();

  /**
   * Encrypt plaintext content for storage.
   * Returns a JSON string containing base64-encoded ciphertext + IV.
   */
  const encryptContent = useCallback(
    async (plaintext: string): Promise<string> => {
      if (!masterKey) throw new Error("Master Key not available");

      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        masterKey,
        data
      );

      const payload: EncryptedPayload = {
        ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(iv),
      };

      return JSON.stringify(payload);
    },
    [masterKey]
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

  return {
    encryptContent,
    decryptContent,
    computeHash,
    isReady: masterKey !== null,
  };
}
