// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { deriveDeviceWrapKey } from "@keeplas/crypto/kdf";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";
import {
  DeviceUnlockError,
  deleteMethod,
  enrollMethod,
  unlockWith,
  type DeviceUnlockEntry,
  type PinServer,
} from "../device-unlock";
import { assertPinShape, validatePin } from "../device-unlock/pin";
import { exportMasterKey, wrapWithKey } from "../device-unlock/key-import";

// IndexedDB stand-in: the browser profile an attacker could copy.
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("../device-unlock/storage", () => ({
  getEntry: async (id: string) => structuredClone(store.get(id) ?? null),
  putEntry: async (entry: { id: string }) => {
    store.set(entry.id, structuredClone(entry));
  },
  deleteEntry: async (id: string) => {
    store.delete(id);
  },
  listEntriesForUser: async () => [...store.values()],
  clearEntries: async () => store.clear(),
}));

const USER = "user1";
const PIN = "0427";

/** In-memory twin of packages/convex/device_pins.ts. */
function fakeServer() {
  const rows = new Map<string, { proof: string; secret: string }>();
  let next = 0;
  const server: PinServer = {
    enroll: vi.fn(async ({ pinProof, secret }) => {
      const pinId = `pin${++next}` as Id<"device_pins">;
      rows.set(pinId, { proof: pinProof, secret });
      return { pinId, trusted: true };
    }),
    release: vi.fn(async ({ pinId, pinProof }) => {
      const row = rows.get(pinId);
      if (!row) return { status: "gone" as const };
      if (row.proof !== pinProof) {
        return { status: "wrong" as const, failCount: 1, maxAttempts: 10 };
      }
      return { status: "ok" as const, secret: row.secret, trusted: true };
    }),
    remove: vi.fn(async ({ pinId }) => {
      rows.delete(pinId);
      return null;
    }),
  };
  return { server, rows };
}

function newMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function sameKey(a: CryptoKey, b: CryptoKey) {
  return (
    uint8ToBase64(await exportMasterKey(a)) ===
    uint8ToBase64(await exportMasterKey(b))
  );
}

/** What an offline attacker tries: the wrap opened with the PIN alone. */
async function opensWithPinAlone(entry: DeviceUnlockEntry, pin: string) {
  const key = await deriveDeviceWrapKey(pin, base64ToUint8(entry.data.deviceSalt));
  try {
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(entry.data.iv) },
      key,
      base64ToUint8(entry.data.wrappedMasterKey),
    );
    return true;
  } catch {
    return false;
  }
}

/** An entry as PIN enrollment wrote it before server-assisted unlock. */
async function seedLegacyEntry(masterKey: CryptoKey, pin: string) {
  const deviceSalt = crypto.getRandomValues(new Uint8Array(16));
  const { iv, wrapped } = await wrapWithKey(
    await exportMasterKey(masterKey),
    await deriveDeviceWrapKey(pin, deviceSalt),
  );
  const entry: DeviceUnlockEntry = {
    id: "legacy",
    userId: USER,
    method: "pin",
    label: "Mac PIN",
    createdAt: 0,
    data: {
      kind: "pin",
      deviceSalt: uint8ToBase64(deviceSalt),
      iv,
      wrappedMasterKey: wrapped,
      failCount: 0,
    },
  };
  store.set(entry.id, entry);
  return entry;
}

function stored(id: string) {
  return store.get(id) as DeviceUnlockEntry | undefined;
}

describe("validatePin", () => {
  it("accepts a 4-digit PIN", () => {
    expect(() => validatePin("0427")).not.toThrow();
  });

  it.each(["123", "12345", "123456", "12a4", ""])("rejects %j", (pin) => {
    expect(() => validatePin(pin)).toThrow();
  });
});

describe("assertPinShape", () => {
  it.each(["0427", "123456", "12345678"])("lets %j try to unlock", (pin) => {
    expect(() => assertPinShape(pin)).not.toThrow();
  });

  it.each(["123", "12a4"])("rejects %j", (pin) => {
    expect(() => assertPinShape(pin)).toThrow();
  });
});

describe("server-assisted device PIN", () => {
  beforeEach(() => {
    store.clear();
  });

  it("leaves nothing in the browser that the PIN alone can open", async () => {
    const { server, rows } = fakeServer();
    const entry = await enrollMethod(USER, await newMasterKey(), {
      method: "pin",
      pin: PIN,
    }, server);

    expect(entry.data.serverPinId).toBeDefined();
    expect(await opensWithPinAlone(entry, PIN)).toBe(false);
    const secret = [...rows.values()][0]!.secret;
    expect(JSON.stringify(stored(entry.id))).not.toContain(secret);
  });

  it("unlocks with the right PIN through the server", async () => {
    const { server } = fakeServer();
    const masterKey = await newMasterKey();
    const entry = await enrollMethod(USER, masterKey, {
      method: "pin",
      pin: PIN,
    }, server);

    const { key, trusted } = await unlockWith(entry.id, PIN, server);
    expect(await sameKey(key, masterKey)).toBe(true);
    expect(trusted).toBe(true);
  });

  it("leaves the attempt count to the server", async () => {
    const { server } = fakeServer();
    const entry = await enrollMethod(USER, await newMasterKey(), {
      method: "pin",
      pin: PIN,
    }, server);

    await expect(unlockWith(entry.id, "9999", server)).rejects.toMatchObject({
      code: "wrong-secret",
    });
    expect(stored(entry.id)).toEqual(entry);
  });

  it("drops the browser's copy once the server forgot the PIN", async () => {
    const { server, rows } = fakeServer();
    const entry = await enrollMethod(USER, await newMasterKey(), {
      method: "pin",
      pin: PIN,
    }, server);
    rows.clear(); // Session ended, or ten wrong PINs.

    await expect(unlockWith(entry.id, PIN, server)).rejects.toBeInstanceOf(
      DeviceUnlockError,
    );
    expect(stored(entry.id)).toBeUndefined();
  });

  it("removing a PIN also forgets its server half", async () => {
    const { server, rows } = fakeServer();
    const entry = await enrollMethod(USER, await newMasterKey(), {
      method: "pin",
      pin: PIN,
    }, server);

    await deleteMethod(entry.id, server);
    expect(rows.size).toBe(0);
    expect(stored(entry.id)).toBeUndefined();
  });
});

describe("legacy PIN-only entries", () => {
  beforeEach(() => {
    store.clear();
  });

  it("still unlock, then are re-sealed with the server half", async () => {
    const { server } = fakeServer();
    const masterKey = await newMasterKey();
    const legacy = await seedLegacyEntry(masterKey, PIN);

    const { key, trusted } = await unlockWith(legacy.id, PIN, server);
    expect(await sameKey(key, masterKey)).toBe(true);
    expect(trusted).toBe(true);

    const upgraded = stored(legacy.id)!;
    expect(upgraded.data.serverPinId).toBeDefined();
    expect(await opensWithPinAlone(upgraded, PIN)).toBe(false);
    const again = await unlockWith(legacy.id, PIN, server);
    expect(await sameKey(again.key, masterKey)).toBe(true);
  });

  it("keep a longer legacy PIN when upgraded", async () => {
    const { server } = fakeServer();
    const masterKey = await newMasterKey();
    const legacy = await seedLegacyEntry(masterKey, "123456");

    await unlockWith(legacy.id, "123456", server);
    const again = await unlockWith(legacy.id, "123456", server);
    expect(await sameKey(again.key, masterKey)).toBe(true);
  });

  it("still unlock when the upgrade cannot reach the server", async () => {
    const { server } = fakeServer();
    vi.mocked(server.enroll).mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const masterKey = await newMasterKey();
    const legacy = await seedLegacyEntry(masterKey, PIN);

    const { key, trusted } = await unlockWith(legacy.id, PIN, server);
    expect(await sameKey(key, masterKey)).toBe(true);
    // Unknown trust: the unlock gets the short (untrusted) lifetime.
    expect(trusted).toBe(false);
    expect(stored(legacy.id)!.data.serverPinId).toBeUndefined();
  });

  it("still count wrong PINs locally until upgraded", async () => {
    const { server } = fakeServer();
    const legacy = await seedLegacyEntry(await newMasterKey(), PIN);

    await expect(unlockWith(legacy.id, "9999", server)).rejects.toMatchObject({
      code: "wrong-secret",
    });
    expect(stored(legacy.id)!.data.failCount).toBe(1);
    expect(server.enroll).not.toHaveBeenCalled();
  });
});
