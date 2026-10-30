import type * as Rtl from "@testing-library/react-native";
import { Appearance } from "react-native";

import { ThemeProvider, useTheme } from "../theme-provider";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

let mockStored: string | null = null;
const mockWrite = jest.fn(() => Promise.resolve());
jest.mock("@/lib/preferences", () => ({
  readPreference: () => Promise.resolve(mockStored),
  writePreference: (...args: unknown[]) => mockWrite(...(args as [])),
}));

const setColorScheme = jest.spyOn(Appearance, "setColorScheme");

async function renderTheme() {
  const view = rtl.renderHook(() => useTheme(), { wrapper: ThemeProvider });
  // Let the stored preference load.
  await rtl.act(async () => {});
  return view.result;
}

describe("ThemeProvider native appearance", () => {
  beforeEach(() => {
    mockStored = null;
    setColorScheme.mockReset();
  });

  it("leaves native UI on the OS scheme by default", async () => {
    await renderTheme();
    expect(setColorScheme).toHaveBeenLastCalledWith("unspecified");
  });

  it("applies a stored override to native UI on launch", async () => {
    mockStored = "dark";
    const theme = await renderTheme();
    expect(theme.current.appearance).toBe("dark");
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");
  });

  it("follows the Settings choice, and hands back to the OS on System", async () => {
    const theme = await renderTheme();
    rtl.act(() => theme.current.setAppearance("light"));
    expect(setColorScheme).toHaveBeenLastCalledWith("light");
    expect(mockWrite).toHaveBeenLastCalledWith("appearance", "light");
    rtl.act(() => theme.current.setAppearance("system"));
    expect(setColorScheme).toHaveBeenLastCalledWith("unspecified");
  });
});
