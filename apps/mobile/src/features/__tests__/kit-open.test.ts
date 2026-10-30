/**
 * @jest-environment node
 */
import type * as Rtl from "@testing-library/react-native";

import { DeviceLockError } from "@/crypto/device-vault";
import { openKeyBundle } from "@/crypto/vault-keys";
import * as DeviceLock from "../../../modules/device-lock";
import {
  isFullKit,
  kitWords,
  useKitOpen,
  vaultOpenErrorKey,
  WrongKitWords,
} from "../kit-open";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("../../../modules/device-lock", () => ({
  isDeviceSecure: jest.fn(() => true),
  setItem: jest.fn(async () => undefined),
  getItem: jest.fn(async () => null),
  deleteItem: jest.fn(async () => undefined),
}));
jest.mock("@/crypto/vault-keys", () => ({ openKeyBundle: jest.fn() }));
jest.mock("@/features/cloud-backup", () => ({
  useEnsureCloudBackup: () => async () => undefined,
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
const mockViewer = { _id: "u1", encryptedKeyBundle: "{}" };
jest.mock("@/providers/session-provider", () => ({
  useViewer: () => mockViewer,
  useSession: () => ({ refreshDeviceVault: () => undefined }),
}));
jest.mock("@/providers/vault-provider", () => ({
  useVault: () => ({ adopt: async () => ({}) }),
}));

const KIT = Array.from(
  { length: 24 },
  (_, i) => `word${"abcdefghijklmnopqrstuvwx"[i]}`,
);

async function failureOf(attempt: Promise<unknown>): Promise<unknown> {
  try {
    await attempt;
  } catch (error) {
    return error;
  }
  throw new Error("expected the kit opening to fail");
}

describe("kit opening", () => {
  const open = () => rtl.renderHook(() => useKitOpen()).result.current;

  beforeEach(() => {
    jest.clearAllMocks();
    (openKeyBundle as jest.Mock).mockResolvedValue({
      masterKey: new Uint8Array(32).fill(7),
      rootKey: new Uint8Array(32).fill(9),
    });
  });

  it("doesn't blame the words when the screen lock refuses the key", async () => {
    (DeviceLock.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("Authentication canceled"),
    );

    const error = await failureOf(open()(KIT.join(" ")));

    expect(error).toBeInstanceOf(DeviceLockError);
    expect(error).not.toBeInstanceOf(WrongKitWords);
    expect(vaultOpenErrorKey(error)).not.toBe("recoveryKit.invalid");
  });

  it("blames the words only when they don't open the key bundle", async () => {
    (openKeyBundle as jest.Mock).mockRejectedValueOnce(
      new Error("The operation failed for an operation-specific reason"),
    );

    const error = await failureOf(open()(KIT.join(" ")));

    expect(error).toBeInstanceOf(WrongKitWords);
    expect(vaultOpenErrorKey(error)).toBe("recoveryKit.invalid");
    expect(DeviceLock.setItem).not.toHaveBeenCalled();
  });

  it("derives the key from the words alone, without the kit's numbers", async () => {
    const numbered = KIT.map(
      (w, i) => `${String(i + 1).padStart(2, "0")} ${w}`,
    );

    await open()(numbered.join("\n"));

    expect(openKeyBundle).toHaveBeenLastCalledWith("{}", KIT);
  });
});

describe("vault opening errors", () => {
  it("names the screen lock, the words or falls back", () => {
    expect(vaultOpenErrorKey(new DeviceLockError())).toBe(
      "recoveryKit.notKept",
    );
    expect(vaultOpenErrorKey(new WrongKitWords())).toBe("recoveryKit.invalid");
    expect(vaultOpenErrorKey(new Error("offline"))).toBe("common.genericError");
    expect(vaultOpenErrorKey(new Error("offline"), "cloudRestore.failed")).toBe(
      "cloudRestore.failed",
    );
  });
});

describe("kit words", () => {
  it("reads typed words, whatever the spacing and case", () => {
    expect(kitWords("  Apple  banana\ncherry ")).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });

  it("drops the numbers and punctuation the printed kit adds", () => {
    expect(kitWords("01 apple 02 banana 03 cherry")).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
    expect(kitWords("1. apple, 2) banana; (3) cherry.")).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
    expect(kitWords("1.apple 2.banana")).toEqual(["apple", "banana"]);
  });

  it("puts numbered words back in order (a kit read column by column)", () => {
    expect(kitWords("01 apple 03 cherry 02 banana 04 date")).toEqual([
      "apple",
      "banana",
      "cherry",
      "date",
    ]);
  });

  it("keeps the typed order when only some words are numbered", () => {
    expect(kitWords("3 apple banana 1 cherry")).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });

  it("counts a numbered kit as a full kit", () => {
    const numbered = KIT.map((w, i) => `${i + 1}. ${w}`).join("\n");
    expect(isFullKit(numbered)).toBe(true);
    expect(isFullKit(KIT.join(" "))).toBe(true);
    expect(isFullKit(KIT.slice(1).join(" "))).toBe(false);
    expect(isFullKit("")).toBe(false);
  });
});
