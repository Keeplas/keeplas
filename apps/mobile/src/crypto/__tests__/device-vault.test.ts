/**
 * @jest-environment node
 */
import * as SecureStore from "expo-secure-store";

import * as DeviceLock from "../../../modules/device-lock";
import {
  DeviceLockError,
  DevicePinError,
  forgetDeviceId,
  forgetDeviceVault,
  devicePinLength,
  hasDeviceVault,
  openCurrentDeviceVault,
  openDeviceVault,
  readDeviceId,
  readDeviceRootKey,
  readReattachToken,
  saveDeviceVault,
  setDevicePin,
  StaleDeviceVault,
  unlockDeviceVault,
  writeDeviceId,
  writeReattachToken,
} from "../device-vault";
import { encryptText, importAesKey } from "../envelope";
import { buildKeyBundle } from "../vault-keys";

// In-memory stand-ins: the native stores only matter here as "where did the
// device wrap key go, and with which protection".
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("../../../modules/device-lock", () => {
  const store = new Map<string, string>();
  return {
    isDeviceSecure: jest.fn(() => true),
    setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItem: jest.fn(async (k: string) => void store.delete(k)),
  };
});

// Argon2id (19 MiB per call) is covered in packages/crypto; here it only
// slows the PIN-attempt tests past Jest's timeout on busy CI runners. A
// SHA-256 stand-in keeps "wrong PIN → wrong key → decrypt fails".
jest.mock("@keeplas/crypto/kdf", () => ({
  deriveDeviceWrapKey: async (secret: string, salt: Uint8Array) =>
    crypto.subtle.importKey(
      "raw",
      await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array([...new TextEncoder().encode(secret), ...salt]),
      ),
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
}));

const masterKey = () => new Uint8Array(32).fill(7);
const rootKey = () => new Uint8Array(32).fill(9);

describe("device vault", () => {
  it("keeps the device wrap key behind the screen lock, which a PIN can open", async () => {
    await saveDeviceVault(
      "u1",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
    );

    expect(DeviceLock.setItem).toHaveBeenCalledWith(
      "keeplas.dwk.u1",
      expect.any(String),
      "Unlock",
    );
    // expo-secure-store's requireAuthentication is biometrics-only.
    for (const [, , options] of (SecureStore.setItemAsync as jest.Mock).mock
      .calls) {
      expect(options?.requireAuthentication).toBeFalsy();
    }
  });

  it("round-trips the MasterKey and RootKey through the screen lock", async () => {
    await saveDeviceVault(
      "u2",
      { masterKey: masterKey(), rootKey: rootKey() },
      "Unlock",
    );

    expect(await unlockDeviceVault("u2", "Unlock")).toEqual(masterKey());
    expect(await readDeviceRootKey("u2", "Back up")).toEqual(rootKey());
    expect(DeviceLock.getItem).toHaveBeenLastCalledWith(
      "keeplas.dwk.u2",
      "Back up",
    );
  });

  it("forgets both entries on sign-out", async () => {
    await saveDeviceVault(
      "u3",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
    );
    await forgetDeviceVault("u3");

    expect(DeviceLock.deleteItem).toHaveBeenCalledWith("keeplas.dwk.u3");
    await expect(unlockDeviceVault("u3", "Unlock")).rejects.toThrow(
      "No vault key on this device",
    );
  });

  it("reports a screen lock that refused the key as a DeviceLockError", async () => {
    (DeviceLock.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("Authentication canceled"),
    );

    await expect(
      saveDeviceVault(
        "u4",
        { masterKey: masterKey(), rootKey: null },
        "Unlock",
      ),
    ).rejects.toBeInstanceOf(DeviceLockError);
    expect(await hasDeviceVault("u4")).toBe(false);
  });

  it("keeps this phone's device row id across sign-outs", async () => {
    await writeDeviceId("u4", "device-1");
    await writeReattachToken("u4", "token-1");
    await forgetDeviceVault("u4");

    expect(await readDeviceId("u4")).toBe("device-1");
    expect(await readReattachToken("u4")).toBe("token-1");
    await writeReattachToken("u4", null);
    expect(await readReattachToken("u4")).toBeNull();
  });

  it("forgets the device row id when the server could not keep it", async () => {
    await writeDeviceId("u5", "device-1");
    await writeReattachToken("u5", "token-1");
    await forgetDeviceId("u5");

    expect(await readDeviceId("u5")).toBeNull();
    expect(await readReattachToken("u5")).toBeNull();
  });
});

async function pinError(attempt: Promise<unknown>): Promise<DevicePinError> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof DevicePinError) return error;
    throw error;
  }
  throw new Error("expected a DevicePinError");
}

describe("device vault PIN", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("needs both the screen lock and the PIN once a PIN is set", async () => {
    await saveDeviceVault(
      "p1",
      { masterKey: masterKey(), rootKey: rootKey() },
      "Unlock",
    );
    expect(await devicePinLength("p1")).toBeNull();
    await setDevicePin("p1", "Unlock", undefined, "1234");

    expect(await devicePinLength("p1")).toBe(4);
    expect((await pinError(unlockDeviceVault("p1", "Unlock"))).code).toBe(
      "required",
    );
    expect(await unlockDeviceVault("p1", "Unlock", "1234")).toEqual(
      masterKey(),
    );
    expect(await readDeviceRootKey("p1", "Back up", "1234")).toEqual(rootKey());
  });

  it("keeps opening a 6-digit PIN saved before PINs had a stored length", async () => {
    await saveDeviceVault(
      "p6",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
      "123456",
    );
    const stored = JSON.parse(
      (await SecureStore.getItemAsync("keeplas.mk.p6"))!,
    ) as { pin: { length?: number } };
    delete stored.pin.length;
    await SecureStore.setItemAsync("keeplas.mk.p6", JSON.stringify(stored));

    expect(await devicePinLength("p6")).toBe(6);
    expect(await unlockDeviceVault("p6", "Unlock", "123456")).toEqual(
      masterKey(),
    );
  });

  it("counts wrong PINs, locks after 5 and wipes this phone's key after 10", async () => {
    await saveDeviceVault(
      "p2",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
      "123456",
    );
    const first = await pinError(unlockDeviceVault("p2", "Unlock", "000000"));
    expect(first.code).toBe("wrong");
    expect(first.detail.remaining).toBe(4);

    for (let i = 0; i < 3; i++) {
      await pinError(unlockDeviceVault("p2", "Unlock", "000000"));
    }
    const locked = await pinError(unlockDeviceVault("p2", "Unlock", "000000"));
    expect(locked.code).toBe("locked");
    expect(
      (await pinError(unlockDeviceVault("p2", "Unlock", "123456"))).code,
    ).toBe("locked");

    for (let i = 0; i < 5; i++) {
      jest.advanceTimersByTime(60_001);
      await pinError(unlockDeviceVault("p2", "Unlock", "000000"));
    }
    expect(await hasDeviceVault("p2")).toBe(false);
  });

  it("counts every wrong PIN when several are tried at once", async () => {
    await saveDeviceVault(
      "p5",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
      "123456",
    );
    const errors = await Promise.all(
      Array.from({ length: 5 }, () =>
        pinError(unlockDeviceVault("p5", "Unlock", "000000")),
      ),
    );
    expect(errors.map((e) => e.code)).toEqual([
      "wrong",
      "wrong",
      "wrong",
      "wrong",
      "locked",
    ]);
  });

  it("resets the count after a right PIN", async () => {
    await saveDeviceVault(
      "p3",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
      "123456",
    );
    await pinError(unlockDeviceVault("p3", "Unlock", "000000"));
    await unlockDeviceVault("p3", "Unlock", "123456");
    expect(
      (await pinError(unlockDeviceVault("p3", "Unlock", "000000"))).detail
        .remaining,
    ).toBe(4);
  });

  it("changes and removes the PIN", async () => {
    await saveDeviceVault(
      "p4",
      { masterKey: masterKey(), rootKey: null },
      "Unlock",
      "123456",
    );
    await setDevicePin("p4", "Unlock", "123456", "654321");
    expect(await unlockDeviceVault("p4", "Unlock", "654321")).toEqual(
      masterKey(),
    );
    await setDevicePin("p4", "Unlock", "654321", undefined);
    expect(await devicePinLength("p4")).toBeNull();
    expect(await unlockDeviceVault("p4", "Unlock")).toEqual(masterKey());
  });
});

describe("device vault after a rotation made on another device", () => {
  const mk1 = () => new Uint8Array(32).fill(1);
  /** The account after the rotation: owner key sealed under MasterKey 1. */
  const rotatedUser = async (id: string, bundleRootKey: Uint8Array) => ({
    _id: id,
    encryptedAsymmetricSecretKey: await encryptText(
      "owner-secret",
      await importAesKey(mk1()),
    ),
    encryptedKeyBundle: await buildKeyBundle(mk1(), bundleRootKey, "salt"),
  });

  it("opens as before when the stored MasterKey is current", async () => {
    await saveDeviceVault("r1", { masterKey: mk1(), rootKey: rootKey() }, "U");
    const user = await rotatedUser("r1", rootKey());
    expect((await openCurrentDeviceVault(user, "U")).masterKey).toEqual(mk1());
  });

  it("catches up with the new MasterKey through the RootKey it holds", async () => {
    // Rotation committed, phone kept MasterKey 0 (lost response, or another
    // phone before finalize): the RootKey still opens the new bundle.
    await saveDeviceVault(
      "r2",
      { masterKey: masterKey(), rootKey: rootKey() },
      "U",
      "1234",
    );
    const user = await rotatedUser("r2", rootKey());
    const keys = await openCurrentDeviceVault(user, "U", "1234");
    expect(keys.masterKey).toEqual(mk1());
    // Stored for next time, behind the same PIN.
    expect((await openDeviceVault("r2", "U", "1234")).masterKey).toEqual(mk1());
  });

  it("refuses a phone whose keys predate the new RootKey", async () => {
    // Finalized rotation: new kit, so the old RootKey opens nothing. The
    // phone must not keep using (or re-publish) the retired MasterKey.
    await saveDeviceVault(
      "r3",
      { masterKey: masterKey(), rootKey: rootKey() },
      "U",
    );
    const user = await rotatedUser("r3", new Uint8Array(32).fill(5));
    await expect(openCurrentDeviceVault(user, "U")).rejects.toBeInstanceOf(
      StaleDeviceVault,
    );
  });
});
