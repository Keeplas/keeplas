import * as ImagePicker from "expo-image-picker";

import { chooseFromLibrary } from "../media";

jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-print", () => ({}));
// No permission API on purpose: the system photo pickers (PHPicker on iOS,
// the Android photo picker) need no library access, so asking for it first
// would only show a needless full-library prompt.
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);

it("opens the system picker without asking for photo library access", async () => {
  launch.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///cache/a.jpg",
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        type: "image",
      },
    ],
  } as never);

  await expect(chooseFromLibrary()).resolves.toEqual([
    expect.objectContaining({ uri: "file:///cache/a.jpg", kind: "image" }),
  ]);
  expect(launch).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: ["images"] }),
  );
});

it("returns nothing when the user cancels", async () => {
  launch.mockResolvedValue({ canceled: true, assets: null } as never);
  await expect(chooseFromLibrary(["videos"])).resolves.toEqual([]);
});
