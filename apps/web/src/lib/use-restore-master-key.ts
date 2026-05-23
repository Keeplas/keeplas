"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
import { useMasterKey } from "./master-key-context";

type LegacyBundle = {
  version?: 1;
  wrappingKey: string;
  iv: string;
  encryptedMasterKey: string;
};

/**
 * Restores the MasterKey from the legacy V1 key bundle stored in Convex.
 * Called on hub load for returning users who already completed onboarding.
 *
 * V2 bundles (Argon2id-derived RootKey from the 24-word phrase) cannot be
 * unwrapped from the server bundle without the user-supplied phrase or a
 * device-unlock secret, so this hook skips them silently. For V2, the unwrapped
 * MasterKey is instead persisted on-device after unlock and restored from
 * IndexedDB by MasterKeyProvider (see master-key-context.tsx / master-key-store.ts).
 *
 * V1 bundles (legacy plaintext-wrappingKey) are still supported here so any
 * pre-existing dev account keeps working through the migration window; once
 * restored, the provider persists the key the same way.
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
        const parsed = JSON.parse(user!.encryptedKeyBundle!) as Record<
          string,
          unknown
        >;

        // Anything carrying V2 material (phraseSalt) must go through
        // UnlockGate — even if a stale `wrappingKey` is also present.
        if (typeof parsed.phraseSalt === "string" && parsed.phraseSalt) {
          return;
        }

        // Explicit non-V1 version: bail. Only `version: 1` or no version
        // is treated as the legacy plaintext-wrappingKey shape.
        if (typeof parsed.version === "number" && parsed.version !== 1) {
          return;
        }

        // Legacy V1: must have a usable wrappingKey, iv and encryptedMasterKey.
        if (
          typeof parsed.wrappingKey !== "string" ||
          !parsed.wrappingKey ||
          typeof parsed.iv !== "string" ||
          !parsed.iv ||
          typeof parsed.encryptedMasterKey !== "string" ||
          !parsed.encryptedMasterKey
        ) {
          return;
        }

        const legacy = parsed as unknown as LegacyBundle;
        const wrappingKeyRaw = base64ToUint8(legacy.wrappingKey);
        const iv = base64ToUint8(legacy.iv);
        const encryptedMasterKey = base64ToUint8(legacy.encryptedMasterKey);

        const wrappingKey = await crypto.subtle.importKey(
          "raw",
          wrappingKeyRaw,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"],
        );

        const masterKeyRaw = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          wrappingKey,
          encryptedMasterKey,
        );

        const restoredKey = await crypto.subtle.importKey(
          "raw",
          masterKeyRaw,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
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
