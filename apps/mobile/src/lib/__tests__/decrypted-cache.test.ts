/**
 * @jest-environment node
 */
import {
  cachedDecrypted,
  clearDecryptedCache,
  rememberDecrypted,
} from "../files";

jest.mock("expo-file-system", () => {
  function File(this: { uri: string; exists: boolean }, uri: string) {
    this.uri = uri;
    this.exists = true;
  }
  File.prototype.delete = function (this: { exists: boolean }) {
    this.exists = false;
  };
  function Directory(this: { exists: boolean }) {
    this.exists = false;
  }
  return {
    File,
    Directory,
    Paths: { cache: "cache", document: "document" },
    FileMode: {},
    UploadType: {},
  };
});

const { File } = jest.requireMock("expo-file-system") as {
  File: new (uri: string) => {
    uri: string;
    exists: boolean;
    delete: () => void;
  };
};

describe("decrypted file cache", () => {
  it("returns a file opened earlier in the session", () => {
    const file = new File("cache/open/a.pdf");
    rememberDecrypted("f1", file as never);
    expect(cachedDecrypted("f1")?.uri).toBe("cache/open/a.pdf");
  });

  it("forgets a file that no longer exists on disk", () => {
    const file = new File("cache/open/b.pdf");
    rememberDecrypted("f2", file as never);
    file.delete();
    expect(cachedDecrypted("f2")).toBeNull();
  });

  it("deletes the older copy when a file is opened again", () => {
    const first = new File("cache/open/c1.pdf");
    const second = new File("cache/open/c2.pdf");
    rememberDecrypted("f3", first as never);
    rememberDecrypted("f3", second as never);
    expect(first.exists).toBe(false);
    expect(cachedDecrypted("f3")?.uri).toBe("cache/open/c2.pdf");
  });

  it("is emptied when the vault locks", () => {
    rememberDecrypted("f4", new File("cache/open/d.pdf") as never);
    clearDecryptedCache();
    expect(cachedDecrypted("f4")).toBeNull();
  });
});
