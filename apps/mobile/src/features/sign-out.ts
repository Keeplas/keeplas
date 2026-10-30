import { useState } from "react";
import { Alert } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { hasDeviceVault } from "@/crypto/device-vault";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * Sign out from Settings or a getting-in screen's Other options. When this
 * phone holds the vault key, ask first: signing out deletes the key and the
 * drafts on this phone, so opening the vault again takes the cloud backup,
 * the 24 words or the trusted contacts (said more strongly without a backup).
 */
export function useConfirmSignOut() {
  const { t } = useI18n();
  const { viewer, signOut } = useSession();
  const backup = useQuery(api.cloud_backup.status, viewer ? {} : "skip");
  const [signingOut, setSigningOut] = useState(false);

  const run = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = async () => {
    if (!viewer || !(await hasDeviceVault(viewer._id))) return run();
    Alert.alert(
      t("signOut.confirmTitle"),
      t(
        backup?.enabled === false
          ? "signOut.confirmBodyNoBackup"
          : "signOut.confirmBody",
      ),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.signOut"),
          style: "destructive",
          onPress: () => void run(),
        },
      ],
    );
  };

  return { confirmSignOut, signingOut };
}
