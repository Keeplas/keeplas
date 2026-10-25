import type * as Rtl from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { BootSplash } from "../boot-splash";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

jest.mock("../../../assets/logo/mark.svg", () => () => null);
jest.mock("../../../assets/logo/mark-inverse.svg", () => () => null);
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));
jest.mock("../ambient", () => ({ usePlayAmbient: () => true }));

describe("BootSplash", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("hides the native splash once it covers the screen", () => {
    rtl.render(<BootSplash visible />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    rtl.fireEvent(rtl.screen.getByTestId("boot-splash"), "layout");
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it("fades out, then unmounts, when the session is ready", () => {
    const view = rtl.render(<BootSplash visible />);
    view.rerender(<BootSplash visible={false} />);
    expect(rtl.screen.getByTestId("boot-splash")).toBeTruthy();
    rtl.act(() => jest.runAllTimers());
    expect(rtl.screen.queryByTestId("boot-splash")).toBeNull();
  });
});
