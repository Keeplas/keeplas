import type * as Rtl from "@testing-library/react-native";
import * as ScreenCapture from "expo-screen-capture";

import { useNoScreenCapture } from "../use-no-screen-capture";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const { renderHook } = jest.requireActual<typeof Rtl>(
  "@testing-library/react-native",
);

jest.mock("expo-screen-capture", () => ({
  usePreventScreenCapture: jest.fn(),
}));

const prevent = jest.mocked(ScreenCapture.usePreventScreenCapture);

describe("useNoScreenCapture", () => {
  it("gives each protected screen its own key", () => {
    // A shared key would let closing the item editor unprotect the item
    // screen still open below it.
    renderHook(() => useNoScreenCapture());
    renderHook(() => useNoScreenCapture());

    const [first, second] = prevent.mock.calls.map(([key]) => key);
    expect(first).toEqual(expect.any(String));
    expect(second).toEqual(expect.any(String));
    expect(first).not.toBe(second);
  });
});
