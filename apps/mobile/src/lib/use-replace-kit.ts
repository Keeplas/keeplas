import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { saveDeviceVault } from "@/crypto/device-vault";
import { createKitMaterial } from "@/crypto/vault-keys";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import { useI18n } from "@/providers/i18n-provider";

/**
 * New 24 words for an existing MasterKey (after a contact recovery, or a kit
 * asked for in Settings): store them, keep the new RootKey behind this
 * phone's screen lock (and its Keeplas code, `pin`), and re-seal the cloud
 * backup. The previous words stop working. Resolves to the new words.
 */
export function useReplaceKit() {
  const { t } = useI18n();
  const storePhraseHash = useMutation(api.onboarding.storeRecoveryPhraseHash);
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const ensureCloudBackup = useEnsureCloudBackup();

  return useCallback(
    async (userId: string, masterKey: Uint8Array, pin?: string) => {
      const kit = await createKitMaterial(masterKey);
      try {
        await storePhraseHash({
          recoveryPhraseHash: kit.recoveryPhraseHash,
          phraseSalt: kit.phraseSalt,
        });
        await storeKeyBundle({
          encryptedKeyBundle: kit.encryptedKeyBundle,
          phraseSalt: kit.phraseSalt,
        });
        await saveDeviceVault(
          userId,
          { masterKey, rootKey: kit.rawRootKey },
          t("unlock.title"),
          pin,
        );
      } catch (error) {
        kit.rawRootKey.fill(0);
        throw error;
      }
      void ensureCloudBackup(kit.rawRootKey);
      return kit.phrase;
    },
    [t, storePhraseHash, storeKeyBundle, ensureCloudBackup],
  );
}
