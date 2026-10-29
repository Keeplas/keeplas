import { router, Stack } from "expo-router";
import type * as Rtl from "expo-router/testing-library";
import { Alert, Text, type AlertButton } from "react-native";

import VoiceNote from "@/app/(app)/capture/voice";
import { draftStore } from "@/features/capture/draft-store";
import { isLockHeld } from "@/lib/auto-lock";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("expo-router/testing-library");

const RECORDING_URI = "file:///cache/recording.m4a";
const mockRecorder = {
  uri: RECORDING_URI,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(async () => undefined),
};
const mockState = { isRecording: true, durationMillis: 3000 };
jest.mock("expo-audio", () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  setAudioModeAsync: async () => undefined,
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => mockState,
}));
const mockDeleted: string[] = [];
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(path: string) {
      this.uri = path;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
}));
jest.mock("@/features/capture/draft-store", () => ({
  draftStore: { addFiles: jest.fn(), update: jest.fn(), get: () => ({}) },
}));
jest.mock("@/features/capture/draft-route", () => ({
  draftHref: (pathname: string) => pathname,
  useDraftParam: () => undefined,
}));
jest.mock("@/features/capture/add-sheet", () => ({
  PermissionSheet: () => null,
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("@/components/screen", () => ({
  Screen: ({
    header,
    children,
  }: {
    header: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {header}
      {children}
    </>
  ),
}));
jest.mock("@/components/nav-bar", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    NavBar: ({ onBack }: { onBack: () => void }) => (
      <Pressable accessibilityLabel="common.back" onPress={onBack} />
    ),
  };
});
jest.mock("@/components/button", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/language", () => ({ LanguageDropdown: () => null }));
jest.mock("@/components/surfaces", () => ({ Callout: () => null }));
jest.mock("@/components/state-message", () => ({ StateSheet: () => null }));

const routes = {
  _layout: () => <Stack />,
  index: () => <Text>home</Text>,
  "capture/voice": VoiceNote,
  "capture/compose": () => <Text>compose</Text>,
};

async function openVoice() {
  const app = rtl.renderRouter(routes, { initialUrl: "/" });
  rtl.act(() => router.push("/capture/voice"));
  await rtl.screen.findByText("capture.save");
  return app;
}

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
  Object.assign(mockState, { isRecording: true, durationMillis: 3000 });
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

it("adds the recording to the draft once on a double tap", async () => {
  const app = await openVoice();
  const save = rtl.screen.getByText("capture.save");
  rtl.fireEvent.press(save);
  rtl.fireEvent.press(save);

  await rtl.waitFor(() => expect(app.getPathname()).toBe("/capture/compose"));
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(draftStore.addFiles).toHaveBeenCalledTimes(1);
  expect(draftStore.addFiles).toHaveBeenCalledWith([
    expect.objectContaining({ uri: RECORDING_URI, kind: "audio" }),
  ]);
  expect(alert).not.toHaveBeenCalled();
});

it("asks before leaving with a recording, and deletes it on discard", async () => {
  const app = await openVoice();
  rtl.fireEvent.press(rtl.screen.getByLabelText("common.back"));

  expect(alert).toHaveBeenCalledTimes(1);
  expect(app.getPathname()).toBe("/capture/voice");

  const buttons = alert.mock.calls[0][2] as AlertButton[];
  await rtl.act(async () => {
    buttons.find((button) => button.style === "destructive")?.onPress?.();
  });
  await rtl.waitFor(() => expect(app.getPathname()).toBe("/"));
  expect(mockDeleted).toEqual([RECORDING_URI]);
  expect(draftStore.addFiles).not.toHaveBeenCalled();
});

it("stays on the screen when the user keeps the recording", async () => {
  const app = await openVoice();
  rtl.fireEvent.press(rtl.screen.getByLabelText("common.back"));

  const buttons = alert.mock.calls[0][2] as AlertButton[];
  rtl.act(() =>
    buttons.find((button) => button.style === "cancel")?.onPress?.(),
  );
  expect(app.getPathname()).toBe("/capture/voice");
  expect(mockDeleted).toEqual([]);
});

it("leaves without asking while nothing was recorded", async () => {
  Object.assign(mockState, { isRecording: false, durationMillis: 0 });
  const app = await openVoice();
  rtl.fireEvent.press(rtl.screen.getByLabelText("common.back"));

  await rtl.waitFor(() => expect(app.getPathname()).toBe("/"));
  expect(alert).not.toHaveBeenCalled();
});

it("keeps the vault from locking while a paused recording exists", async () => {
  Object.assign(mockState, { isRecording: false, durationMillis: 3000 });
  await openVoice();
  expect(isLockHeld()).toBe(true);
});
