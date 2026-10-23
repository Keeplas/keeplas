import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { openCloudBackup } from "@keeplas/crypto/cloud";

import { saveDeviceVault } from "@/crypto/device-vault";
import { openKeyBundleWithRootKey } from "@/crypto/vault-keys";
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
 * The backup this phone can restore ("iCloud" / "Google"), or null. The CBK
 * only syncs within its platform: Block Store never reaches iCloud.
 */
export function useRestorableBackup(): string | null {
  const backup = useQuery(api.cloud_backup.status);
  return backup?.enabled && backup.provider === CloudKey.provider
    ? providerName(backup.provider)
    : null;
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
 * envelope until this session proved the account's number.
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
      await adopt(masterKey);
    } finally {
      rootKey.fill(0);
    }
    refreshDeviceVault();
  }, [viewer, restore, adopt, refreshDeviceVault, t]);
}
