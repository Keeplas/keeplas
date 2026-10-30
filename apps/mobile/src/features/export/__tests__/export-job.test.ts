/**
 * @jest-environment node
 */
import { AppState } from "react-native";
import type { File } from "expo-file-system";

import {
  discardExport,
  ExportCancelled,
  getExportPhase,
  startExport,
  watchExport,
  type ExportRun,
} from "../export-job";

jest.mock("expo-file-system", () => {
  const folder = { exists: true, delete: jest.fn() };
  return { Directory: jest.fn(() => folder), Paths: { cache: "cache" } };
});

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock("../../../../modules/background-work", () => ({
  beginBackgroundWork: jest.fn(),
  reportBackgroundProgress: jest.fn(),
  endBackgroundWork: jest.fn(),
  onBackgroundWorkExpired: jest.fn(() => ({ remove: jest.fn() })),
}));

const folder = new (
  jest.requireMock("expo-file-system") as {
    Directory: new () => { delete: jest.Mock };
  }
).Directory();

const { scheduleNotificationAsync } = jest.requireMock(
  "expo-notifications",
) as { scheduleNotificationAsync: jest.Mock };
const background = jest.requireMock("../../../../modules/background-work") as {
  beginBackgroundWork: jest.Mock;
  reportBackgroundProgress: jest.Mock;
  endBackgroundWork: jest.Mock;
  onBackgroundWorkExpired: jest.Mock;
};

function setAppState(state: string) {
  Object.defineProperty(AppState, "currentState", {
    value: state,
    configurable: true,
  });
}

const texts = {
  title: "Export my data",
  running: "Decrypting",
  ready: "Ready",
  failed: "Failed",
};
const archive = { uri: "cache/export/a.zip" } as unknown as File;
const succeeds: ExportRun = async (onProgress) => {
  onProgress({ stage: "files", done: 1, total: 2 });
  return { archive, skipped: 0 };
};

beforeEach(() => {
  jest.clearAllMocks();
  setAppState("active");
  discardExport();
  folder.delete.mockClear();
});

describe("background export", () => {
  it("keeps the app running and notifies on Keeplas's own channel when it ends out of view", async () => {
    await startExport(succeeds, texts);

    expect(background.beginBackgroundWork).toHaveBeenCalledWith(
      "Export my data",
      "Decrypting",
    );
    expect(background.reportBackgroundProgress).toHaveBeenCalledWith(1, 2);
    expect(background.endBackgroundWork).toHaveBeenCalledWith(true);
    expect(getExportPhase()).toEqual({ kind: "ready", archive, skipped: 0 });
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Export my data",
        body: "Ready",
        data: { url: "/export" },
      },
      // Android: the "Keeplas" channel, not Expo's "Miscellaneous" fallback.
      trigger: { channelId: "default" },
    });
  });

  it("does not notify while the export screen is in view, and deletes the archive when left", async () => {
    const leave = watchExport();
    await startExport(succeeds, texts);

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    leave();
    expect(getExportPhase()).toEqual({ kind: "idle" });
    expect(folder.delete).toHaveBeenCalled();
  });

  it("keeps an archive finished in the background until the user has seen it", async () => {
    const lockUnmount = watchExport();
    setAppState("background");
    await startExport(succeeds, texts);
    expect(scheduleNotificationAsync).toHaveBeenCalled();

    // The vault locks on return and unmounts the screen: the archive stays.
    folder.delete.mockClear();
    lockUnmount();
    expect(getExportPhase().kind).toBe("ready");
    expect(folder.delete).not.toHaveBeenCalled();

    // The notification brings the user back to the screen.
    setAppState("active");
    const leave = watchExport();
    leave();
    expect(getExportPhase()).toEqual({ kind: "idle" });
    expect(folder.delete).toHaveBeenCalled();
  });

  it("notifies a failure and logs its reason without storage URLs", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await startExport(async () => {
      throw new Error(
        "unexpected end of stream on https://x.convex.cloud/api/storage/abc",
      );
    }, texts);

    expect(warn).toHaveBeenCalledWith(
      "Export failed",
      "Error: unexpected end of stream on <url>",
    );
    warn.mockRestore();

    expect(getExportPhase()).toEqual({ kind: "failed" });
    expect(background.endBackgroundWork).toHaveBeenCalledWith(false);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: "Failed" }),
      }),
    );
  });

  it("cancels quietly when the system stops the background work", async () => {
    await startExport(async (_onProgress, cancelled) => {
      const [[systemStops]] = background.onBackgroundWorkExpired.mock.calls;
      systemStops();
      if (cancelled()) throw new ExportCancelled();
      return { archive, skipped: 0 };
    }, texts);

    expect(getExportPhase()).toEqual({ kind: "idle" });
    expect(background.endBackgroundWork).toHaveBeenCalledWith(false);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("drops an export that finishes after sign-out", async () => {
    await startExport(async () => {
      discardExport();
      return { archive, skipped: 0 };
    }, texts);

    expect(getExportPhase()).toEqual({ kind: "idle" });
    expect(folder.delete).toHaveBeenCalled();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
