"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useMasterKey } from "./master-key-context";

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type LegacyBundle = {
  version?: 1;
  wrappingKey: string;
  iv: string;
  encryptedMasterKey: string;
};

type V2Bundle = {
  version: 2;
  phraseSalt: string;
  iv: string;
  encryptedMasterKey: string;
};

/**
 * Restores the MasterKey from the encrypted key bundle stored in Convex.
 * Called on dashboard load for returning users who already completed
 * onboarding.
 *
 * V2 bundles (Argon2id-derived RootKey from the 24-word phrase) cannot be
 * unwrapped without the user-supplied phrase or a device-unlock secret —
 * Phase 5 will replace this hook with a prompt-driven flow. Until then we
 * skip silently so the app does not crash; the user will need to re-enter
 * their 24 words via the upcoming login flow.
 *
 * V1 bundles (legacy plaintext-wrappingKey) are still supported here so
 * any pre-existing dev account keeps working through the migration window.
 */
export function useRestoreMasterKey() {
  const { masterKey, setMasterKey } = useMasterKey();
  const user = useQuery(api.users.viewer);
  const restoringRef = useRef(false);

  useEffect(() => {
    if (masterKey) return;
    if (!user?.encryptedKeyBundle) return;
    if (restoringRef.current) return;
    restoringRef.current = true;

    async function restore() {
      try {
        const parsed = JSON.parse(user!.encryptedKeyBundle!) as
          | LegacyBundle
          | V2Bundle;

        if ("version" in parsed && parsed.version === 2) {
          // V2 bundle — RootKey required. Will be handled by the upcoming
          // login + device-unlock flow.
          return;
        }

        const legacy = parsed as LegacyBundle;
        const wrappingKeyRaw = base64ToUint8(legacy.wrappingKey);
        const iv = base64ToUint8(legacy.iv);
        const encryptedMasterKey = base64ToUint8(legacy.encryptedMasterKey);

        const wrappingKey = await crypto.subtle.importKey(
          "raw",
          wrappingKeyRaw,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );

        const masterKeyRaw = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          wrappingKey,
          encryptedMasterKey
        );

        const restoredKey = await crypto.subtle.importKey(
          "raw",
          masterKeyRaw,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );

        setMasterKey(restoredKey);
      } catch (err) {
        console.error("Failed to restore Master Key:", err);
      } finally {
        restoringRef.current = false;
      }
    }

    restore();
  }, [masterKey, user, setMasterKey]);
}
