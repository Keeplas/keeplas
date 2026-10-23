import { useCallback } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { openCloudBackup, sealCloudBackup } from "@keeplas/crypto/cloud";

import { saveDeviceVault } from "@/crypto/device-vault";
import { openKeyBundleWithRootKey } from "@/crypto/vault-keys";
import { needsCloudBackup } from "@/lib/backup-policy";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import * as CloudKey from "../../modules/cloud-key";

/** Synced keychain entry holding this account's Cloud Backup Key (D7). */
export const cloudKeyName = (userId: string) => `keeplas.cbk.${userId}`;

/** Display name of a backup provider. */
export const providerName = (provider: CloudKey.CloudKeyProvider) =>
  provider === "icloud" ? "iCloud" : "Google";

/**
 * The backup this phone can restore ("iCloud" / "Google"), null when there
 * is none, undefined while loading. The CBK only syncs within its platform:
 * Block Store never reaches iCloud.
 */
export function useRestorableBackup(): string | null | undefined {
  const backup = useQuery(api.cloud_backup.status);
  if (backup === undefined) return undefined;
  return backup?.enabled && backup.provider === CloudKey.provider
    ? providerName(backup.provider)
    : null;
}

/**
 * Turn the backup on (or re-seal it): a new CBK into the synced keychain,
 * the envelope to Keeplas, stamped with the 24 words' salt it opens. Checks
 * first that the RootKey opens the account's current key bundle, so a phone
 * holding a key from older words never backs up a key that opens nothing.
 */
export function useSealCloudBackup() {
  const convex = useConvex();
  const save = useAuditedMutation(api.cloud_backup.save);

  return useCallback(
    async (rootKey: Uint8Array) => {
      const user = await convex.query(api.users.viewer);
      if (!user?.encryptedKeyBundle || !user.phraseSalt)
        throw new Error("No vault to back up");
      (await openKeyBundleWithRootKey(user.encryptedKeyBundle, rootKey)).fill(
        0,
      );
      const sealed = await sealCloudBackup({ rootKey, userId: user._id });
      await CloudKey.write(cloudKeyName(user._id), sealed.cbk);
      await save({
        provider: CloudKey.provider,
        envelope: sealed.envelope,
        phraseSalt: user.phraseSalt,
      });
    },
    [convex, save],
  );
}

/**
 * D7, on by default: back the vault up whenever it opens (creation, unlock,
 * 24 words, contacts) unless it already is or the owner turned it off. Takes
 * ownership of `rootKey` and wipes it. Never throws: a failed backup must not
 * keep the vault closed, the next opening tries again.
 */
export function useEnsureCloudBackup() {
  const convex = useConvex();
  const seal = useSealCloudBackup();

  return useCallback(
    async (rootKey: Uint8Array) => {
      try {
        if (needsCloudBackup(await convex.query(api.cloud_backup.status)))
          await seal(rootKey);
      } catch {
        // Retried at the next opening; the backup screen shows it is off.
      } finally {
        rootKey.fill(0);
      }
    },
    [convex, seal],
  );
}

/** This phone's keychain doesn't hold the CBK (other account or platform). */
export class CloudKeyMissing extends Error {
  constructor() {
    super("Cloud backup key not found on this phone");
    this.name = "CloudKeyMissing";
  }
}

/**
 * New phone: CBK from the synced keychain + envelope from Keeplas → RootKey
 * → MasterKey, kept behind this phone's screen lock. The server refuses the
 * envelope until this session proved the account's number. Resolves to the
 * live MasterKey.
 */
export function useCloudRestore() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();
  const restore = useAuditedMutation(api.cloud_backup.restore);

  return useCallback(async () => {
    if (!viewer.encryptedKeyBundle) throw new Error("No vault to restore");
    const cbk = await CloudKey.read(cloudKeyName(viewer._id));
    if (!cbk) throw new CloudKeyMissing();
    const { envelope } = await restore();
    const rootKey = await openCloudBackup({
      envelope,
      cbk,
      userId: viewer._id,
    });
    try {
      const masterKey = await openKeyBundleWithRootKey(
        viewer.encryptedKeyBundle,
        rootKey,
      );
      await saveDeviceVault(
        viewer._id,
        { masterKey, rootKey },
        t("unlock.title"),
      );
      const key = await adopt(masterKey);
      refreshDeviceVault();
      return key;
    } finally {
      rootKey.fill(0);
    }
  }, [viewer, restore, adopt, refreshDeviceVault, t]);
}
