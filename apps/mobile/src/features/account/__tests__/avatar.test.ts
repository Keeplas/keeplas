import { ImageManipulator } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { PermissionDenied } from "@/features/capture/media";
import { isLockHeld } from "@/lib/auto-lock";
import {
  AVATAR_PX,
  AvatarTooLarge,
  MAX_AVATAR_BYTES,
  pickAvatar,
  uploadAvatar,
} from "../avatar";

const mockDisk = new Map<string, number>();
const mockUploads: { url: string; path: string; headers: object }[] = [];
const mockUpload = { status: 200 };

jest.mock("expo-file-system", () => ({
  UploadType: { BINARY_CONTENT: 0 },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockDisk.has(this.uri);
    }
    get size() {
      return mockDisk.get(this.uri) ?? 0;
    }
    delete() {
      mockDisk.delete(this.uri);
    }
    createUploadTask(url: string, options: { headers: object }) {
      mockUploads.push({ url, path: this.uri, headers: options.headers });
      return {
        addListener: () => ({ remove: () => undefined }),
        uploadAsync: async () => ({
          status: mockUpload.status,
          body: JSON.stringify({ storageId: "storage-1" }),
        }),
        release: () => undefined,
      };
    }
  },
}));

jest.mock("expo-device", () => ({ isDevice: true }));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: jest.fn() },
}));

jest.mock("@/features/capture/media", () => ({
  PermissionDenied: class extends Error {
    what: string;
    constructor(what: string) {
      super(`PERMISSION_${what.toUpperCase()}`);
      this.what = what;
    }
  },
  CameraUnavailable: class extends Error {},
}));

const picker = jest.mocked(ImagePicker);
const manipulate = jest.mocked(ImageManipulator.manipulate);

beforeEach(() => {
  mockDisk.clear();
  mockUploads.length = 0;
  mockUpload.status = 200;
  jest.clearAllMocks();
});

describe("uploadAvatar", () => {
  it("posts the JPEG to the upload URL and deletes the local copy", async () => {
    mockDisk.set("file:///avatar.jpg", 40_000);
    const storageId = await uploadAvatar("file:///avatar.jpg", async () =>
      Promise.resolve("https://upload.test"),
    );
    expect(storageId).toBe("storage-1");
    expect(mockUploads).toEqual([
      {
        url: "https://upload.test",
        path: "file:///avatar.jpg",
        headers: { "Content-Type": "image/jpeg" },
      },
    ]);
    expect(mockDisk.has("file:///avatar.jpg")).toBe(false);
  });

  it("refuses an image over the limit without asking for an upload URL", async () => {
    mockDisk.set("file:///big.jpg", MAX_AVATAR_BYTES + 1);
    const getUrl = jest.fn();
    await expect(uploadAvatar("file:///big.jpg", getUrl)).rejects.toThrow(
      AvatarTooLarge,
    );
    expect(getUrl).not.toHaveBeenCalled();
    expect(mockDisk.has("file:///big.jpg")).toBe(false);
  });

  it("reports a rejected upload", async () => {
    mockDisk.set("file:///avatar.jpg", 40_000);
    mockUpload.status = 413;
    await expect(
      uploadAvatar("file:///avatar.jpg", async () => "https://upload.test"),
    ).rejects.toThrow("Upload failed (413)");
  });
});

describe("pickAvatar", () => {
  function mockManipulator() {
    const resize = jest.fn();
    const saveAsync = jest.fn().mockResolvedValue({ uri: "file:///small.jpg" });
    manipulate.mockReturnValue({
      resize,
      renderAsync: async () => ({ saveAsync }),
    } as never);
    return { resize, saveAsync };
  }

  it("crops a library photo square and resizes it to a JPEG", async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    let heldDuringPicker = false;
    picker.launchImageLibraryAsync.mockImplementation(async () => {
      heldDuringPicker = isLockHeld();
      return {
        canceled: false,
        assets: [{ uri: "file:///picked.heic" }],
      } as never;
    });
    const { resize, saveAsync } = mockManipulator();

    await expect(pickAvatar("library")).resolves.toBe("file:///small.jpg");
    expect(heldDuringPicker).toBe(true);
    expect(isLockHeld()).toBe(false);
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
    expect(manipulate).toHaveBeenCalledWith("file:///picked.heic");
    expect(resize).toHaveBeenCalledWith({
      width: AVATAR_PX,
      height: AVATAR_PX,
    });
    expect(saveAsync).toHaveBeenCalledWith({ format: "jpeg", compress: 0.8 });
  });

  it("returns null when the user cancels", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);
    await expect(pickAvatar("camera")).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
  });

  it("throws PermissionDenied when photo access is off", async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);
    await expect(pickAvatar("library")).rejects.toBeInstanceOf(
      PermissionDenied,
    );
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
