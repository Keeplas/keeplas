import type * as Rtl from "@testing-library/react-native";
import type { PermissionResponse } from "expo-camera";
import { AppState, Linking } from "react-native";

import { useCameraAccess } from "../use-camera-access";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

let mockPermission: PermissionResponse | null = null;
const mockRequest = jest.fn();
const mockGet = jest.fn();
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [mockPermission, mockRequest, mockGet],
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const undetermined = {
  status: "undetermined",
  granted: false,
  canAskAgain: true,
  expires: "never",
} as PermissionResponse;
// Android after a first "Don't allow": denied, but the system can still ask.
const deniedOnce = {
  ...undetermined,
  status: "denied",
} as PermissionResponse;
const blocked = { ...deniedOnce, canAskAgain: false } as PermissionResponse;
const granted = {
  ...undetermined,
  status: "granted",
  granted: true,
} as PermissionResponse;

let appStateListener: ((state: string) => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = null;
  appStateListener = undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, cb) => {
    appStateListener = cb as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
});

function render() {
  return rtl.renderHook(() => useCameraAccess());
}

it("asks the system once while access was never asked", () => {
  mockPermission = undetermined;
  const { rerender } = render();
  rerender({});
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

it("doesn't bring the system prompt back after a denial", () => {
  mockPermission = undetermined;
  const { rerender, result } = render();
  mockPermission = deniedOnce;
  rerender({});
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(result.current.denied).toBe(true);
  expect(result.current.granted).toBe(false);
});

it("never asks on its own when access was already denied", () => {
  mockPermission = deniedOnce;
  render();
  expect(mockRequest).not.toHaveBeenCalled();
});

it("offers the system prompt again while it can still show", () => {
  mockPermission = deniedOnce;
  const { result } = render();
  expect(result.current.allow.label).toBe("permissions.allowCamera");
  result.current.allow.onPress();
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

it("sends to Settings once the system can't ask anymore", () => {
  const openSettings = jest
    .spyOn(Linking, "openSettings")
    .mockResolvedValue(undefined);
  mockPermission = blocked;
  const { result } = render();
  expect(result.current.allow.label).toBe("common.openSettings");
  result.current.allow.onPress();
  expect(openSettings).toHaveBeenCalled();
  expect(mockRequest).not.toHaveBeenCalled();
});

it("re-reads access when the app comes back from Settings", () => {
  mockPermission = blocked;
  render();
  appStateListener?.("background");
  expect(mockGet).not.toHaveBeenCalled();
  appStateListener?.("active");
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it("is neither granted nor denied while loading or asking", () => {
  const { result, rerender } = render();
  expect(result.current).toMatchObject({ granted: false, denied: false });
  mockPermission = undetermined;
  rerender({});
  expect(result.current).toMatchObject({ granted: false, denied: false });
  mockPermission = granted;
  rerender({});
  expect(result.current).toMatchObject({ granted: true, denied: false });
});
