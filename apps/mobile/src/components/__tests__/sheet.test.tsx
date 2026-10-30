import type * as Rtl from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { BottomSheet } from "../sheet";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");
type Node = ReturnType<typeof rtl.screen.getByRole>;

jest.mock("react-native-keyboard-controller", () => ({
  KeyboardAvoidingView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock("../icon", () => ({ Icon: () => null }));
jest.mock("../toaster", () => ({ Toaster: () => null }));
jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));

function setup() {
  const onDismiss = jest.fn();
  rtl.render(
    <BottomSheet visible onDismiss={onDismiss} title="Add">
      <Pressable accessibilityRole="button" onPress={() => undefined}>
        <Text>Scan a document</Text>
      </Pressable>
    </BottomSheet>,
  );
  return { onDismiss };
}

/** Host views between the sheet's content and the Modal. */
function ancestors(node: Node) {
  const chain: Node[] = [];
  for (let at = node.parent; at; at = at.parent) {
    if (typeof at.type === "string") chain.push(at);
  }
  return chain;
}

describe("BottomSheet for screen readers", () => {
  it("doesn't fold its controls into one element (VoiceOver can't enter one)", () => {
    setup();
    const option = rtl.screen.getByRole("button", { name: "Scan a document" });
    // The backdrop (tap outside to close) and the sheet (stops those taps).
    const wrappers = ancestors(option).filter(
      (view) => view.props.onResponderGrant,
    );
    expect(wrappers).toHaveLength(2);
    for (const view of wrappers) expect(view.props.accessible).toBe(false);
  });

  it("is modal for VoiceOver and closes on its escape gesture", () => {
    const { onDismiss } = setup();
    const option = rtl.screen.getByRole("button", { name: "Scan a document" });
    const modal = ancestors(option).find(
      (view) => view.props.accessibilityViewIsModal,
    );
    expect(modal).toBeDefined();
    rtl.fireEvent(modal!, "accessibilityEscape");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the close button reachable", () => {
    const { onDismiss } = setup();
    rtl.fireEvent.press(
      rtl.screen.getByRole("button", { name: "common.close" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
