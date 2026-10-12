import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { api } from "@keeplas/backend/_generated/api";

import { readDeviceId } from "@/crypto/device-vault";
import { useAuditedMutation } from "./use-audited-mutation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Registers this phone and routes security-notification deep links. */
export function usePushNotifications(userId: string) {
  const router = useRouter();
  const setToken = useAuditedMutation(api.devices.setPushToken);
  useEffect(() => {
    if (Platform.OS === "web") return;
    void (async () => {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return;
      const deviceId = await readDeviceId(userId);
      if (!deviceId) return;
      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await setToken({ deviceId: deviceId as Id<"devices">, pushToken });
    })().catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === "string" && url.startsWith("/"))
          router.push(url as never);
      },
    );
    return () => subscription.remove();
  }, [userId, setToken, router]);
}
