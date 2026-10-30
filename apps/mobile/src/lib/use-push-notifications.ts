import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { api } from "@keeplas/backend/_generated/api";

import { useViewer } from "@/providers/session-provider";
import { useAuditedMutation } from "./use-audited-mutation";
import { useEnsureDevice } from "./use-register-passkey";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Whether this phone may show security alerts, asking the system while it
 * still can. No in-app pre-prompt (App Review 5.1.1): the system dialog is
 * the only question, and a refusal is changed in the phone's settings.
 */
export async function allowPushNotifications(): Promise<boolean> {
  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Keeplas",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Sends this phone's Expo push token once alerts are allowed. */
function useRegisterPushToken() {
  const setToken = useAuditedMutation(api.devices.setPushToken);
  return useCallback(
    async (deviceId: Id<"devices">) => {
      if (!(await allowPushNotifications())) return;
      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await setToken({ deviceId, pushToken });
    },
    [setToken],
  );
}

/**
 * Routes security-notification taps (also the one that cold-started the
 * app) and returns the registration of this phone's Expo push token.
 */
export function usePushNotifications() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url !== "string" || !url.startsWith("/")) return;
    // Consumed once: a remount must not replay the same tap.
    Notifications.clearLastNotificationResponse();
    router.push(url as never);
  }, [response, router]);

  return useRegisterPushToken();
}

/**
 * The Settings "Security alerts" row: this phone's permission, re-read when
 * the app comes back (from the phone's settings), and what a tap does: the
 * system prompt while it can still be asked, the phone's settings otherwise.
 * Alerts allowed since the last look get this phone's token.
 */
export function useSecurityAlerts() {
  const viewer = useViewer();
  const ensureDevice = useEnsureDevice();
  const register = useRegisterPushToken();
  const [permission, setPermission] =
    useState<Notifications.NotificationPermissionsStatus>();
  const granted = useRef<boolean | null>(null);

  const apply = useCallback(
    (next: Notifications.NotificationPermissionsStatus) => {
      if (next.granted && granted.current === false) {
        ensureDevice(viewer._id)
          .then(register)
          .catch(() => undefined); // Retried at the next launch.
      }
      granted.current = next.granted;
      setPermission(next);
    },
    [ensureDevice, register, viewer._id],
  );

  useEffect(() => {
    const read = () => void Notifications.getPermissionsAsync().then(apply);
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => subscription.remove();
  }, [apply]);

  const state: "on" | "off" | "blocked" | undefined = !permission
    ? undefined
    : permission.granted
      ? "on"
      : permission.canAskAgain
        ? "off"
        : "blocked";

  const change = useCallback(async () => {
    if (state === "off") {
      await allowPushNotifications();
      apply(await Notifications.getPermissionsAsync());
    } else if (state) {
      await Linking.openSettings();
    }
  }, [state, apply]);

  return { state, change };
}
