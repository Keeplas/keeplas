import { Platform } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";

import { deviceDraftFiles, keepDraftsOutOfBackups } from "../draft-db";

jest.mock("expo-file-system", () => {
  const disk = new Set<string>();
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      this.uri = name
        ? `${typeof parent === "string" ? parent : parent.uri}/${name}`
        : String(parent);
    }
    get name() {
      return this.uri.split("/").pop()!;
    }
    get exists() {
      return disk.has(this.uri);
    }
    move(target: File) {
      disk.delete(this.uri);
      disk.add(target.uri);
    }
    delete() {
      disk.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) {
      this.uri = `${typeof parent === "string" ? parent : parent.uri}/${name}`;
    }
    get exists() {
      return disk.has(this.uri);
    }
    create() {
      const parts = this.uri.split("/");
      for (let i = 4; i <= parts.length; i++) {
        disk.add(parts.slice(0, i).join("/"));
      }
    }
    delete() {
      for (const uri of [...disk]) {
        if (uri === this.uri || uri.startsWith(`${this.uri}/`))
          disk.delete(uri);
      }
    }
  }
  return {
    File,
    Directory,
    Paths: { document: "file:///app/Documents" },
    mockDisk: disk,
  };
});
jest.mock("react-native-blob-util", () => ({
  __esModule: true,
  default: { ios: { excludeFromBackupKey: jest.fn(async () => undefined) } },
}));
jest.mock("@/lib/secure-db", () => ({ secureDb: jest.fn() }));

const { mockDisk } = jest.requireMock("expo-file-system") as {
  mockDisk: Set<string>;
};
const exclude = jest.mocked(ReactNativeBlobUtil.ios.excludeFromBackupKey);

beforeEach(() => {
  mockDisk.clear();
  exclude.mockClear();
  Platform.OS = "ios";
});

describe("draft files on this phone", () => {
  it("keeps the drafts folder out of iCloud and computer backups (iOS)", () => {
    mockDisk.add("file:///app/tmp/scan-1.jpg");

    const kept = deviceDraftFiles.keep("d1", "file:///app/tmp/scan-1.jpg");

    expect(kept).toMatch(/^file:\/\/\/app\/Documents\/drafts\/d1\//);
    expect(exclude).toHaveBeenCalledWith("/app/Documents/drafts");
  });

  it("covers a drafts folder an older version made", () => {
    mockDisk.add("file:///app/Documents/drafts");
    keepDraftsOutOfBackups();
    expect(exclude).toHaveBeenCalledWith("/app/Documents/drafts");
  });

  it("has nothing to flag before the first draft file", () => {
    keepDraftsOutOfBackups();
    expect(exclude).not.toHaveBeenCalled();
  });

  it("leaves Android alone: its backup rules already skip app files", () => {
    Platform.OS = "android";
    mockDisk.add("file:///app/Documents/drafts");
    keepDraftsOutOfBackups();
    expect(exclude).not.toHaveBeenCalled();
  });
});
