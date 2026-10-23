import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { saveDeviceVault } from "@/crypto/device-vault";
import { createVaultMaterial, type VaultMaterial } from "@/crypto/vault-keys";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import { useAuditedMutation } from "./use-audited-mutation";

/**
 * M01-4 "Create my vault": generate the key material on the phone, keep the
 * MasterKey behind the screen lock on this device, store exactly what the
 * web onboarding stores, then back the vault up to iCloud / Google (D7). The
 * 24 words are never shown: the owner can create a kit later in Settings. A
 * retry reuses the same material, so every server call is idempotent
 * (`setPublicKey` accepts the same key twice).
 */
export function useCreateVault() {
  const { t } = useI18n();
  const { adopt, setFinishingSetup } = useVault();
  const { refreshDeviceVault } = useSession();
  const storePhraseHash = useMutation(api.onboarding.storeRecoveryPhraseHash);
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const setPublicKey = useAuditedMutation(api.users.setPublicKey);
  const ensureCloudBackup = useEnsureCloudBackup();
  const material = useRef<VaultMaterial | null>(null);

  return useCallback(
    async (
      userId: string,
      onPhase: (phase: "generating" | "saving") => void,
    ) => {
      onPhase("generating");
      material.current ??= await createVaultMaterial();
      const m = material.current;

      // Keep the setup screens reachable once the account has a vault.
      setFinishingSetup(true);
      await saveDeviceVault(
        userId,
        { masterKey: m.rawMasterKey, rootKey: m.rawRootKey },
        t("unlock.title"),
      );
      await adopt(m.rawMasterKey.slice());

      onPhase("saving");
      await storePhraseHash({
        recoveryPhraseHash: m.recoveryPhraseHash,
        phraseSalt: m.phraseSalt,
      });
      await storeKeyBundle({
        encryptedKeyBundle: m.encryptedKeyBundle,
        phraseSalt: m.phraseSalt,
      });
      await setPublicKey(m.publicKeys);
      await ensureCloudBackup(m.rawRootKey.slice());
      refreshDeviceVault();
    },
    [
      t,
      adopt,
      setFinishingSetup,
      refreshDeviceVault,
      storePhraseHash,
      storeKeyBundle,
      setPublicKey,
      ensureCloudBackup,
    ],
  );
}
