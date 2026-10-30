import type * as Rtl from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { ErrorText } from "../error-text";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));

const announce = jest
  .spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions")
  .mockImplementation(() => undefined);

describe("ErrorText", () => {
  beforeEach(() => announce.mockClear());

  it("renders and announces nothing without a message", () => {
    rtl.render(<ErrorText>{null}</ErrorText>);
    expect(rtl.screen.toJSON()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it("announces the message when it appears and when it changes", () => {
    const view = rtl.render(<ErrorText>{null}</ErrorText>);
    view.rerender(<ErrorText>Wrong PIN. 4 tries left.</ErrorText>);
    expect(rtl.screen.getByText("Wrong PIN. 4 tries left.")).toBeTruthy();
    view.rerender(<ErrorText>Wrong PIN. 4 tries left.</ErrorText>);
    view.rerender(<ErrorText>Wrong PIN. 3 tries left.</ErrorText>);
    expect(announce.mock.calls).toEqual([
      ["Wrong PIN. 4 tries left.", { queue: true }],
      ["Wrong PIN. 3 tries left.", { queue: true }],
    ]);
  });
});
