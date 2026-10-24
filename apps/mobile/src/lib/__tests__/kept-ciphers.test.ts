import { clearKeptCiphers, hasKeptCipher, trimKeptCiphers } from "../files";

jest.mock("expo-file-system", () => {
  const disk = new Map<string, { size: number; modificationTime: number }>();
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      this.uri = name
        ? `${typeof parent === "string" ? parent : parent.uri}/${name}`
        : String(parent);
    }
    get exists() {
      return disk.has(this.uri);
    }
    info() {
      return disk.get(this.uri) ?? { size: 0, modificationTime: 0 };
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
      return [...disk.keys()].some((uri) => uri.startsWith(`${this.uri}/`));
    }
    create() {}
    list() {
      return [...disk.keys()]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => new File(uri));
    }
    delete() {
      for (const uri of [...disk.keys()]) {
        if (uri.startsWith(`${this.uri}/`)) disk.delete(uri);
      }
    }
  }
  return {
    File,
    Directory,
    Paths: { cache: "cache", document: "document" },
    FileMode: {},
    UploadType: {},
    mockDisk: disk,
  };
});

const { mockDisk } = jest.requireMock("expo-file-system") as {
  mockDisk: Map<string, { size: number; modificationTime: number }>;
};
const MB = 1024 * 1024;

describe("kept ciphertext cache", () => {
  beforeEach(() => mockDisk.clear());

  it("keeps the most recently opened files within the size limit", () => {
    mockDisk.set("cache/cipher/old.bin", {
      size: 300 * MB,
      modificationTime: 1,
    });
    mockDisk.set("cache/cipher/mid.bin", {
      size: 150 * MB,
      modificationTime: 2,
    });
    mockDisk.set("cache/cipher/new.bin", {
      size: 100 * MB,
      modificationTime: 3,
    });

    trimKeptCiphers(300 * MB);

    expect(hasKeptCipher("new")).toBe(true);
    expect(hasKeptCipher("mid")).toBe(true);
    expect(hasKeptCipher("old")).toBe(false);
  });

  it("finds a kept file by its id, whatever characters the id has", () => {
    mockDisk.set("cache/cipher/kg_2a-b.bin", { size: 1, modificationTime: 1 });
    expect(hasKeptCipher("kg/2a-b")).toBe(true);
    expect(hasKeptCipher("other")).toBe(false);
  });

  it("drops every kept file on sign-out", () => {
    mockDisk.set("cache/cipher/a.bin", { size: 1, modificationTime: 1 });
    mockDisk.set("cache/open/plain.pdf", { size: 1, modificationTime: 1 });
    clearKeptCiphers();
    expect(hasKeptCipher("a")).toBe(false);
    expect(mockDisk.has("cache/open/plain.pdf")).toBe(true);
  });
});
