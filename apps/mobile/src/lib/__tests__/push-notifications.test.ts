import { Alert } from "react-native";
import * as Notifications from "expo-notifications";

import { allowPushNotifications } from "../use-push-notifications";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
// Installs that answered the old in-app alert kept "keeplas.pref.pushPrompted".
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "true"),
  setItemAsync: jest.fn(),
}));
jest.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: jest.fn(),
}));
jest.mock("@/lib/use-register-passkey", () => ({ useEnsureDevice: jest.fn() }));
jest.mock("@/providers/session-provider", () => ({ useViewer: jest.fn() }));

const mocked = jest.mocked(Notifications);
const permission = (granted: boolean, canAskAgain: boolean) =>
  ({ granted, canAskAgain }) as Notifications.NotificationPermissionsStatus;

beforeEach(() => jest.clearAllMocks());

describe("allowPushNotifications", () => {
  it("asks the system directly, without an in-app pre-prompt", async () => {
    const alert = jest.spyOn(Alert, "alert");
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(permission(true, true));

    await expect(allowPushNotifications()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it("asks on installs that only saw the old 'Not now' alert", async () => {
    // The OS was never asked, so its status is still undetermined.
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(permission(false, false));

    await expect(allowPushNotifications()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("leaves a refusal to the phone's settings", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));

    await expect(allowPushNotifications()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("doesn't ask when alerts are already allowed", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(true, true));

    await expect(allowPushNotifications()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
