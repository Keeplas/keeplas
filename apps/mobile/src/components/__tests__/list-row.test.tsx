import type * as Rtl from "@testing-library/react-native";
import { Pressable } from "react-native";

import { ListRow } from "../surfaces";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");
type Node = ReturnType<typeof rtl.screen.getByRole>;

jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("../icon", () => ({ Icon: () => null }));
jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));

/** Whether an accessible host view encloses `node` (VoiceOver can't enter it). */
function insideAccessible(node: Node) {
  for (let at = node.parent; at; at = at.parent) {
    if (typeof at.type === "string" && at.props.accessible) return true;
  }
  return false;
}

const remove = (onPress = jest.fn()) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Remove"
    onPress={onPress}
  />
);

describe("ListRow for screen readers", () => {
  it("keeps its action button out of the row's press", () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    rtl.render(
      <ListRow title="Draft" onPress={onPress} action={remove(onRemove)} />,
    );
    const action = rtl.screen.getByRole("button", { name: "Remove" });
    expect(insideAccessible(action)).toBe(false);
    rtl.fireEvent.press(action);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    rtl.fireEvent.press(rtl.screen.getByRole("button", { name: "Draft" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not one element without a press, so its trailing parts are reachable", () => {
    rtl.render(<ListRow title="Inbox" trailing={remove()} />);
    expect(
      insideAccessible(rtl.screen.getByRole("button", { name: "Remove" })),
    ).toBe(false);
  });

  it("announces the chosen row of a choice list as selected", () => {
    rtl.render(
      <>
        <ListRow title="scan.pdf" selected onPress={() => undefined} />
        <ListRow title="photo.jpg" selected={false} onPress={() => undefined} />
      </>,
    );
    expect(
      rtl.screen.getByRole("button", { name: "scan.pdf", selected: true }),
    ).toBeTruthy();
    expect(
      rtl.screen.getByRole("button", { name: "photo.jpg", selected: false }),
    ).toBeTruthy();
  });
});
