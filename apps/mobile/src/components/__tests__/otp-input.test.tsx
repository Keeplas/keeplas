import type * as Rtl from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { OtpInput } from "../otp-input";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("../text", () => ({ Text: jest.requireActual("react-native").Text }));

const getString = jest.spyOn(ReactNative.Clipboard, "getString");

function setup(clipboard: string, secure = false) {
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
    />,
  );
  return { onChange, onComplete };
}

const longPress = async () => {
  await rtl.act(async () => {
    rtl.fireEvent(rtl.screen.getByLabelText("Code"), "longPress");
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
