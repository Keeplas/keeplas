import { createRef } from "react";
import type * as Rtl from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { translate } from "@/i18n/translate";
import { OtpInput } from "../otp-input";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

// Any token resolves to a colour (the focus glow parses it).
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => "#000000" }) }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      jest.requireActual("@/i18n/translate").translate("en", key, params),
  }),
}));
const mockReveal = jest.fn();
jest.mock("../screen", () => ({ useRevealAboveKeyboard: () => mockReveal }));
jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));

const getString = jest.spyOn(ReactNative.Clipboard, "getString");
const LABEL = translate("en", "verify.field", { label: "Code", count: 6 });

function setup(
  clipboard: string,
  secure = false,
  keepVisible?: React.RefObject<ReactNative.View | null>,
) {
  getString.mockResolvedValue(clipboard);
  const onChange = jest.fn();
  const onComplete = jest.fn();
  rtl.render(
    <OtpInput
      value=""
      onChange={onChange}
      onComplete={onComplete}
      label="Code"
      secure={secure}
      autoFocus={false}
      keepVisible={keepVisible}
    />,
  );
  return { onChange, onComplete };
}

const field = () => rtl.screen.getByLabelText(LABEL);

const longPress = async () => {
  await rtl.act(async () => {
    rtl.fireEvent(field(), "longPress");
  });
};

describe("OTP paste", () => {
  beforeEach(() => getString.mockReset());

  it("fills the code copied from WhatsApp on a long press", async () => {
    const { onChange, onComplete } = setup("Your code: 123 456");
    await longPress();
    expect(onChange).toHaveBeenCalledWith("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("ignores a clipboard that doesn't hold a whole code", async () => {
    const { onChange } = setup("+44 7700 900101");
    await longPress();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never reads the clipboard for a secure PIN", async () => {
    setup("123456", true);
    await longPress();
    expect(getString).not.toHaveBeenCalled();
  });
});

describe("OTP field for screen readers and the keyboard", () => {
  it("is one text field labelled with the code length", () => {
    setup("");
    expect(field().type).toBe("TextInput");
    expect(LABEL).toBe("Code, 6 digits");
  });

  it("covers the whole row, so the keyboard lifts the row, not its top line", () => {
    setup("");
    const style = ReactNative.StyleSheet.flatten(field().props.style);
    expect(style).toMatchObject({
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      pointerEvents: "none",
    });
    // Not fully transparent: TalkBack skips a view at opacity 0.
    expect(style.opacity).toBeGreaterThan(0);
  });

  it("hides the drawn boxes and doesn't group the row into one element", () => {
    setup("");
    // The pressable row (focus, long-press paste) around the field.
    let row = field().parent!;
    while (!row.props.onResponderGrant) row = row.parent!;
    expect(row.props.accessible).toBe(false);
    const boxes = row.children.find(
      (child) =>
        typeof child !== "string" &&
        child.props.importantForAccessibility === "no-hide-descendants",
    );
    expect(boxes).toBeDefined();
    expect(typeof boxes !== "string" && boxes?.props).toMatchObject({
      accessibilityElementsHidden: true,
    });
  });

  it("lifts the given block above the keyboard when focused", () => {
    const block = createRef<ReactNative.View>();
    setup("", true, block);
    rtl.fireEvent(field(), "focus");
    expect(mockReveal).toHaveBeenCalledWith(block.current);
  });
});
