import { router, Stack, Tabs } from "expo-router";
import type * as Rtl from "expo-router/testing-library";
import { Text } from "react-native";

import type { Stage } from "@/lib/session-stage";
import { AppHeader } from "../app-header";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("expo-router/testing-library");

jest.mock("../../../assets/logo/mark.svg", () => () => null);
jest.mock("../../../assets/logo/mark-inverse.svg", () => () => null);
jest.mock("../language", () => ({ LanguageDropdown: () => null }));
jest.mock("../icon", () => ({ Icon: () => null }));
jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ scheme: "light" }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
let mockStage: Stage = "ready";
jest.mock("@/providers/session-provider", () => ({
  useSession: () => ({ stage: mockStage, settingUp: false }),
}));

const withHeader = (name: string) =>
  function ScreenWithHeader() {
    return (
      <>
        <AppHeader />
        <Text>{name}</Text>
      </>
    );
  };

// Same navigator tree as the app: root stack › (app) stack › tabs.
const routes = {
  _layout: () => <Stack />,
  unlock: withHeader("unlock"),
  help: withHeader("help"),
  "(app)/_layout": () => <Stack />,
  "(app)/(tabs)/_layout": () => <Tabs />,
  "(app)/(tabs)/home": withHeader("home"),
  "(app)/(tabs)/settings": withHeader("settings"),
  "(app)/devices": withHeader("devices"),
};

const pressLogo = () =>
  rtl.fireEvent.press(rtl.screen.getByLabelText("common.appName"));

describe("AppHeader logo", () => {
  beforeEach(() => {
    mockStage = "ready";
  });

  it("goes home from another tab", () => {
    const app = rtl.renderRouter(routes, { initialUrl: "/settings" });
    pressLogo();
    expect(app.getPathname()).toBe("/home");
  });

  it("goes home from a screen pushed over the tabs", () => {
    const app = rtl.renderRouter(routes, { initialUrl: "/settings" });
    rtl.act(() => router.push("/devices"));
    pressLogo();
    expect(app.getPathname()).toBe("/home");
  });

  it("goes to the stage's first screen while locked", () => {
    mockStage = "locked";
    const app = rtl.renderRouter(routes, { initialUrl: "/unlock" });
    rtl.act(() => router.push("/help"));
    pressLogo();
    expect(app.getPathname()).toBe("/unlock");
  });
});
