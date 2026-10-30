import type * as Rtl from "@testing-library/react-native";

import PhoneScreen from "@/app/(auth)/phone";
import VerifyScreen from "@/app/(auth)/verify";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("convex/react", () => ({
  useConvex: () => ({
    connectionState: () => ({ isWebSocketConnected: true }),
    subscribeToConnectionState: () => () => undefined,
  }),
}));
const mockSignIn = jest.fn();
jest.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));
const mockRequestCode = jest.fn(async () => undefined);
jest.mock("@/lib/use-request-phone-code", () => ({
  AttestationFailed: class extends Error {},
  useRequestPhoneCode: () => mockRequestCode,
}));
jest.mock("@/lib/use-phone-field", () => ({
  usePhoneField: () => ({ inputProps: {}, validate: () => "+14165550123" }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, language: "en" }),
}));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("@/components/screen", () => ({
  Screen: ({
    children,
    footer,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("@/components/button", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/components/language", () => ({ LanguageSegment: () => null }));
const mockFocusPhone = jest.fn();
jest.mock("@/components/phone-input", () => {
  const { useImperativeHandle } = jest.requireActual("react");
  return {
    PhoneInput: ({ ref }: { ref?: React.Ref<{ focus: () => void }> }) => {
      useImperativeHandle(ref, () => ({ focus: mockFocusPhone }));
      return null;
    },
  };
});
jest.mock("@/components/stepper", () => ({ RequiredSteps: () => null }));
jest.mock("@/components/surfaces", () => ({ Callout: () => null }));
jest.mock("@/features/code-verification", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    CodeVerification: ({
      onSubmit,
    }: {
      onSubmit: (code: string) => Promise<void>;
    }) => (
      <Pressable onPress={() => onSubmit("123456")}>
        <Text>submit-code</Text>
      </Pressable>
    ),
  };
});

describe("sign-up asks for the first name", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it("requires a first name before sending the code", async () => {
    rtl.render(<PhoneScreen />);
    await rtl.act(() => rtl.fireEvent.press(rtl.screen.getByText("phone.cta")));
    expect(rtl.screen.getByText("phone.nameRequired")).toBeTruthy();
    expect(mockRequestCode).not.toHaveBeenCalled();
  });

  it("carries the first name to the code screen", async () => {
    rtl.render(<PhoneScreen />);
    rtl.fireEvent.changeText(
      rtl.screen.getByLabelText("home.firstName"),
      "  Marie ",
    );
    await rtl.act(() => rtl.fireEvent.press(rtl.screen.getByText("phone.cta")));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/verify",
      params: { phone: "+14165550123", intent: "signup", name: "Marie" },
    });
  });

  it("moves on to the phone number from the first name's next key", () => {
    rtl.render(<PhoneScreen />);
    rtl.fireEvent(rtl.screen.getByLabelText("home.firstName"), "submitEditing");
    expect(mockFocusPhone).toHaveBeenCalled();
  });

  it("does not ask for it on sign-in", async () => {
    mockParams = { intent: "signin" };
    rtl.render(<PhoneScreen />);
    expect(rtl.screen.queryByLabelText("home.firstName")).toBeNull();
    await rtl.act(() => rtl.fireEvent.press(rtl.screen.getByText("phone.cta")));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/verify",
      params: { phone: "+14165550123", intent: "signin" },
    });
  });

  it("creates the account with the first name", async () => {
    mockParams = { phone: "+14165550123", intent: "signup", name: "Marie" };
    rtl.render(<VerifyScreen />);
    await rtl.act(() =>
      rtl.fireEvent.press(rtl.screen.getByText("submit-code")),
    );
    expect(mockSignIn).toHaveBeenCalledWith(
      "phone-otp",
      expect.objectContaining({ flow: "signUp", name: "Marie" }),
    );
  });
});
