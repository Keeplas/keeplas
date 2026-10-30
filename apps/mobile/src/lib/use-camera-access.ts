import { useEffect, useRef } from "react";
import { AppState, Linking } from "react-native";
import { useCameraPermissions } from "expo-camera";

import { useI18n } from "@/providers/i18n-provider";

/**
 * Camera access for a camera screen (document scan, QR scan).
 *
 * Asks the system on its own at most once per visit, and only while it has
 * never asked: after a first "Don't allow" Android keeps `canAskAgain` true,
 * so asking whenever access is off brings the system prompt straight back.
 * Then `allow` is the in-app next step: the system prompt again while it can
 * still show, else Settings. Access is re-read when the app comes back to
 * the foreground, since the user may have changed it in Settings.
 */
export function useCameraAccess() {
  const { t } = useI18n();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const asked = useRef(false);

  const undetermined = permission?.status === "undetermined";
  useEffect(() => {
    if (!undetermined || asked.current) return;
    asked.current = true;
    void requestPermission();
  }, [undetermined, requestPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  const granted = permission?.granted ?? false;
  return {
    granted,
    denied: !!permission && !granted && !undetermined,
    allow: permission?.canAskAgain
      ? {
          label: t("permissions.allowCamera"),
          onPress: () => void requestPermission(),
        }
      : {
          label: t("common.openSettings"),
          onPress: () => void Linking.openSettings(),
        },
  };
}
