import { prepareVideo, VIDEO_BITRATE, VIDEO_MAX_PX } from "../media";

const mockSizes = new Map<string, number>();
const mockDeleted: string[] = [];

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockSizes.get(this.uri) ?? 0;
    }
    get exists() {
      return mockSizes.has(this.uri);
    }
    delete() {
      mockDeleted.push(this.uri);
    }
    async base64() {
      return "cG9zdGVy";
    }
  },
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: () => ({
      resize: jest.fn(),
      renderAsync: async () => ({
        saveAsync: async () => ({ uri: "file:///cache/poster.jpg" }),
      }),
    }),
  },
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-print", () => ({}));
jest.mock("@/lib/auto-lock", () => ({
  keepUnlockedWhile: (task: () => unknown) => task(),
}));

const mockCompress = jest.fn();
const compressor = async () =>
  ({
    Video: { compress: (...args: unknown[]) => mockCompress(...args) },
    createVideoThumbnail: async () => ({ path: "/cache/thumb.jpg" }),
  }) as never;

const MB = 1024 * 1024;
const video = {
  uri: "file:///cache/IMG_1.MOV",
  name: "IMG_1.MOV",
  mimeType: "video/quicktime",
  kind: "video" as const,
  durationSec: 60,
};

describe("prepareVideo", () => {
  beforeEach(() => {
    mockSizes.clear();
    mockDeleted.length = 0;
    mockCompress.mockReset();
  });

  it("makes a large video lighter, up to 1080p, and adds a poster", async () => {
    mockSizes.set(video.uri, 120 * MB);
    mockSizes.set("file:///cache/out.mp4", 40 * MB);
    mockCompress.mockImplementation(
      async (_uri: string, _opts: unknown, onProgress: (p: number) => void) => {
        onProgress(50);
        return "/cache/out.mp4";
      },
    );
    const progress: number[] = [];
    const prepared = await prepareVideo(
      video,
      (r) => progress.push(r),
      compressor,
    );

    expect(mockCompress).toHaveBeenCalledWith(
      video.uri,
      {
        compressionMethod: "manual",
        maxSize: VIDEO_MAX_PX,
        bitrate: VIDEO_BITRATE,
      },
      expect.any(Function),
    );
    expect(progress).toEqual([0.5]);
    expect(prepared).toMatchObject({
      uri: "file:///cache/out.mp4",
      name: "IMG_1.mp4",
      mimeType: "video/mp4",
      durationSec: 60,
      poster: "data:image/jpeg;base64,cG9zdGVy",
    });
  });

  it("leaves a light video as it is, with a poster", async () => {
    mockSizes.set(video.uri, 3 * MB);
    const prepared = await prepareVideo(video, undefined, compressor);
    expect(mockCompress).not.toHaveBeenCalled();
    expect(prepared.uri).toBe(video.uri);
    expect(prepared.poster).toMatch(/^data:image\/jpeg/);
  });

  it("keeps the original when compressing does not make it smaller", async () => {
    mockSizes.set(video.uri, 20 * MB);
    mockSizes.set("file:///cache/out.mp4", 25 * MB);
    mockCompress.mockResolvedValue("file:///cache/out.mp4");
    const prepared = await prepareVideo(video, undefined, compressor);
    expect(prepared.uri).toBe(video.uri);
    expect(mockDeleted).toContain("file:///cache/out.mp4");
  });

  it("falls back to the original video if the compressor fails", async () => {
    mockSizes.set(video.uri, 50 * MB);
    mockCompress.mockRejectedValue(new Error("no encoder"));
    expect(await prepareVideo(video, undefined, compressor)).toEqual(video);
  });

  it("does not touch photos or documents", async () => {
    const photo = { ...video, kind: "image" as const, mimeType: "image/jpeg" };
    expect(await prepareVideo(photo, undefined, compressor)).toBe(photo);
    expect(mockCompress).not.toHaveBeenCalled();
  });
});
