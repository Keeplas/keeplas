/**
 * @jest-environment node
 */
import type { secureDb as SecureDb } from "../secure-db";

const mockDelete = jest.fn();
const mockOpen = jest.fn((_: { name: string; encryptionKey: string }) => ({
  execute: jest.fn(async () => ({ rows: [] })),
  delete: mockDelete,
}));
const mockStore = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => mockStore.get(key) ?? null);

jest.mock("@op-engineering/op-sqlite", () => ({
  open: (options: { name: string; encryptionKey: string }) => mockOpen(options),
}));
jest.mock("../device-store", () => ({
  deviceStore: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => void mockStore.set(key, value),
  },
}));

// A fresh module per test: the opened database is kept module-wide.
function load(): typeof SecureDb {
  let secureDb!: typeof SecureDb;
  jest.isolateModules(() => {
    ({ secureDb } = jest.requireActual<{ secureDb: typeof SecureDb }>(
      "../secure-db",
    ));
  });
  return secureDb;
}

beforeEach(() => {
  mockStore.clear();
  mockOpen.mockClear();
  mockDelete.mockClear();
  mockGetItem.mockClear();
});

describe("secure database", () => {
  it("keeps its key in the device-only store (unlocked phone, this device)", async () => {
    await load()();
    const key = mockStore.get("keeplas.outbox.dbkey");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(mockOpen).toHaveBeenCalledWith({
      name: "keeplas-outbox.sqlite",
      encryptionKey: key,
    });
  });

  it("drops a database file left without its key (restored from a backup)", async () => {
    // The key never leaves the phone but the file may come back from an
    // iPhone backup or a transfer: unreadable, so start a fresh one.
    await load()();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });

  it("reopens an existing install's database with its key", async () => {
    mockStore.set("keeplas.outbox.dbkey", "ab".repeat(32));
    await load()();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockOpen).toHaveBeenCalledWith({
      name: "keeplas-outbox.sqlite",
      encryptionKey: "ab".repeat(32),
    });
  });

  it("tries again after the key could not be read (phone locked)", async () => {
    mockStore.set("keeplas.outbox.dbkey", "ab".repeat(32));
    mockGetItem.mockImplementationOnce(() => {
      throw new Error("User interaction is not allowed.");
    });
    const secureDb = load();

    await expect(secureDb()).rejects.toThrow("not allowed");
    await expect(secureDb()).resolves.toBeDefined();
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
