import { DOWNLOAD_ATTEMPTS, downloadWithRetry } from "../files";

jest.mock("expo-file-system", () => {
  const outcomes: ("fail" | "ok")[] = [];
  const createDownloadTask = jest.fn(() => ({
    downloadAsync: jest.fn(() =>
      outcomes.shift() === "ok"
        ? Promise.resolve({})
        : Promise.reject(new Error("timeout")),
    ),
  }));
  return {
    File: Object.assign(jest.fn(), { createDownloadTask }),
    Directory: jest.fn(),
    Paths: { cache: "cache", document: "document" },
    FileMode: {},
    UploadType: {},
    mockOutcomes: outcomes,
  };
});

const fs = jest.requireMock("expo-file-system") as {
  File: { createDownloadTask: jest.Mock };
  mockOutcomes: ("fail" | "ok")[];
};

function target() {
  return { exists: true, delete: jest.fn() };
}

beforeEach(() => {
  fs.File.createDownloadTask.mockClear();
  fs.mockOutcomes.length = 0;
});

it("retries a failed download and keeps the file of the attempt that worked", async () => {
  fs.mockOutcomes.push("fail", "ok");
  const file = target();

  await downloadWithRetry("https://storage/blob", file as never);

  expect(fs.File.createDownloadTask).toHaveBeenCalledTimes(2);
  expect(file.delete).toHaveBeenCalledTimes(1);
});

it("gives up after the last attempt with the download error", async () => {
  fs.mockOutcomes.push(...Array(DOWNLOAD_ATTEMPTS).fill("fail"));
  const file = target();

  await expect(
    downloadWithRetry("https://storage/blob", file as never),
  ).rejects.toThrow("timeout");
  expect(fs.File.createDownloadTask).toHaveBeenCalledTimes(DOWNLOAD_ATTEMPTS);
});
