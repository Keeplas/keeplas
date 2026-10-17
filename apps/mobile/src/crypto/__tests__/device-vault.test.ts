/**
 * @jest-environment node
 */
import * as SecureStore from "expo-secure-store";

import * as DeviceLock from "../../../modules/device-lock";
import {
  forgetDeviceVault,
  readDeviceRootKey,
  saveDeviceVault,
  unlockDeviceVault,
} from "../device-vault";

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
});
