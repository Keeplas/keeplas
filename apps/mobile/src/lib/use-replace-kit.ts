import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { saveDeviceVault, StaleDeviceVault } from "@/crypto/device-vault";
import { opensOwnerKey } from "@/crypto/owner-keys";
import { createKitMaterial, importMasterKey } from "@/crypto/vault-keys";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import { useEnsureSessionProof, useProveVault } from "@/features/vault-proof";
import { useI18n } from "@/providers/i18n-provider";

/**
 * New 24 words for an existing MasterKey (after a contact recovery, or a kit
 * asked for in Settings): store them, keep the new RootKey behind this
 * phone's screen lock (and its Keeplas code, `pin`), and re-seal the cloud
 * backup. The previous words stop working. Resolves to the new words.
 *
 * Refuses (StaleDeviceVault) a MasterKey that no longer opens the account's
 * owner key, e.g. one kept from before a rotation: sealing it into the kit
 * and the backup would replace the only way back to the current one.
 */
export function useReplaceKit() {
  const { t } = useI18n();
  const convex = useConvex();
  const storePhraseHash = useMutation(api.onboarding.storeRecoveryPhraseHash);
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const ensureCloudBackup = useEnsureCloudBackup();
  const ensureSessionProof = useEnsureSessionProof();
  const proveVault = useProveVault();

  return useCallback(
    async (userId: string, masterKey: Uint8Array, pin?: string) => {
      const key = await importMasterKey(masterKey);
      const user = await convex.query(api.users.viewer);
      if (!user || !(await opensOwnerKey(user, key))) {
        throw new StaleDeviceVault();
      }
      // Replacing the kit of an existing vault needs a proven session, and
      // the key bundle a vault proof once the account has an identity key
      // (a phone proof alone could come from a phone with a stale MasterKey).
      if (user.identityPublicKey) await proveVault(key);
      else await ensureSessionProof(key);
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
    [
      t,
      convex,
      storePhraseHash,
      storeKeyBundle,
      ensureCloudBackup,
      ensureSessionProof,
      proveVault,
    ],
  );
}
