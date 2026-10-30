import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";

import { StateSheet } from "@/components/state-message";
import { useI18n } from "@/providers/i18n-provider";
import { isDeviceSecure } from "../../modules/device-lock";

/**
 * Gate for anything that keeps a key behind the phone's screen lock (a
 * passkey, the vault key). `ensure()` is false on a phone without a screen
 * lock and opens the "Set up a screen lock" sheet, which the screen renders
 * once as `sheet`.
 */
export function useScreenLock() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  const ensure = useCallback(() => {
    if (isDeviceSecure()) return true;
    setVisible(true);
    return false;
  }, []);

  const close = () => setVisible(false);
  const sheet = (
    <StateSheet
      visible={visible}
      onDismiss={close}
      icon="face-id"
      tone="info"
      title={t("passkey.screenLockTitle")}
      body={t("passkey.screenLockBody")}
      primary={{
        label: t("common.openSettings"),
        // Android opens the screen-lock page; iOS apps can only open their own settings.
        onPress: () =>
          Platform.OS === "android"
            ? Linking.sendIntent("android.settings.SECURITY_SETTINGS")
            : Linking.openSettings(),
      }}
      secondary={{ label: t("common.notNow"), onPress: close }}
    />
  );

  return { ensure, sheet };
}
