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

/**
 * Restores the Master Key from the encrypted key bundle stored in Convex.
 * Called on dashboard load for returning users who already completed onboarding.
 *
 * MVP approach: the bundle contains the wrapping key + IV + encrypted master key.
 * We decrypt the master key using the wrapping key.
 */
export function useRestoreMasterKey() {
  const { masterKey, setMasterKey } = useMasterKey();
  const user = useQuery(api.users.viewer);
  const restoringRef = useRef(false);

  useEffect(() => {
    if (masterKey) return; // Already have it
    if (!user?.encryptedKeyBundle) return; // No bundle yet
    if (restoringRef.current) return; // Already restoring
    restoringRef.current = true;

    async function restore() {
      try {
        const bundle = JSON.parse(user!.encryptedKeyBundle!);
        const wrappingKeyRaw = base64ToUint8(bundle.wrappingKey);
        const iv = base64ToUint8(bundle.iv);
        const encryptedMasterKey = base64ToUint8(bundle.encryptedMasterKey);

        // Import the wrapping key
        const wrappingKey = await crypto.subtle.importKey(
          "raw",
          wrappingKeyRaw,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );

        // Decrypt the master key
        const masterKeyRaw = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          wrappingKey,
          encryptedMasterKey
        );

        // Import as AES-GCM key
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
