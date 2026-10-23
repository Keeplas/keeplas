import { useCallback, useEffect } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { api } from "@keeplas/backend/_generated/api";

import { useI18n } from "@/providers/i18n-provider";
import { readPreference, writePreference } from "./preferences";
import { useAuditedMutation } from "./use-audited-mutation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Routes security-notification taps (also the one that cold-started the
 * app) and returns the registration of this phone's Expo push token.
 * The system prompt comes after one in-app explanation, asked only once;
 * "Not now" leaves it to the phone's settings.
 */
export function usePushNotifications() {
  const router = useRouter();
  const { t } = useI18n();
  const setToken = useAuditedMutation(api.devices.setPushToken);
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url !== "string" || !url.startsWith("/")) return;
    // Consumed once: a remount must not replay the same tap.
    Notifications.clearLastNotificationResponse();
    router.push(url as never);
  }, [response, router]);

  return useCallback(
    async (deviceId: Id<"devices">) => {
      // Android 13+ only shows the permission prompt once a channel exists.
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Keeplas",
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (!current.granted) {
        if (!current.canAskAgain || (await readPreference("pushPrompted"))) {
          return;
        }
        await writePreference("pushPrompted", "true");
        const wanted = await new Promise<boolean>((resolve) =>
          Alert.alert(t("push.title"), t("push.body"), [
            {
              text: t("push.notNow"),
              style: "cancel",
              onPress: () => resolve(false),
            },
            { text: t("push.allow"), onPress: () => resolve(true) },
          ]),
        );
        if (!wanted) return;
        if (!(await Notifications.requestPermissionsAsync()).granted) return;
      }
      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await setToken({ deviceId, pushToken });
    },
    [setToken, t],
  );
}
