/**
 * @jest-environment node
 */
import { deviceStore } from "../device-store";

// An iOS-like keychain: items are found by service + key whatever their
// accessibility, and writing over an existing item changes its value only
// (expo-secure-store's SecItemUpdate path), never its accessibility.
const mockKeychain = new Map<string, { value: string; accessible: string }>();
const mockSlot = (key: string, service = "app") => `${service}/${key}`;
type MockOptions = { keychainService?: string; keychainAccessible?: string };

jest.mock("expo-secure-store", () => {
  const service = (o?: MockOptions) => o?.keychainService ?? "app";
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItem: (key: string, o?: MockOptions) =>
      mockKeychain.get(mockSlot(key, service(o)))?.value ?? null,
    setItem: (key: string, value: string, o?: MockOptions) => {
      const existing = mockKeychain.get(mockSlot(key, service(o)));
      mockKeychain.set(mockSlot(key, service(o)), {
        value,
        accessible:
          existing?.accessible ?? o?.keychainAccessible ?? "WHEN_UNLOCKED",
      });
    },
    deleteItemAsync: async (key: string, o?: MockOptions) =>
      void mockKeychain.delete(mockSlot(key, service(o))),
  };
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => mockKeychain.clear());

describe("device store", () => {
  it("keeps entries on this phone, readable only while it is unlocked", () => {
    deviceStore.setItem("token", "jwt");
    expect(deviceStore.getItem("token")).toBe("jwt");
    expect([...mockKeychain.values()]).toEqual([
      { value: "jwt", accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY" },
    ]);
  });

  it("moves an entry saved before (migratable to another phone) on first read", async () => {
    mockKeychain.set(mockSlot("token"), {
      value: "jwt",
      accessible: "WHEN_UNLOCKED",
    });

    expect(deviceStore.getItem("token")).toBe("jwt");
    await settle();

    expect([...mockKeychain.values()]).toEqual([
      { value: "jwt", accessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY" },
    ]);
    expect(deviceStore.getItem("token")).toBe("jwt");
  });

  it("returns null for an entry this phone never saved", () => {
    expect(deviceStore.getItem("missing")).toBeNull();
  });

  it("removes both the moved entry and a copy never read since the update", async () => {
    deviceStore.setItem("token", "new");
    mockKeychain.set(mockSlot("token"), {
      value: "old",
      accessible: "WHEN_UNLOCKED",
    });

    await deviceStore.removeItem("token");

    expect(mockKeychain.size).toBe(0);
  });
});
