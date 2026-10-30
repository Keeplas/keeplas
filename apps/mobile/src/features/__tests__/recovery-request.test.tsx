import { Alert, type AlertButton } from "react-native";
import type * as Rtl from "@testing-library/react-native";

import { RecoveryRequestCard } from "@/features/recovery-request";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

const HOUR = 3_600_000;
const request = (status: string) => ({
  requestId: "r1",
  status,
  newDevicePublicKey: "pk",
  createdAt: 0,
  windowEndsAt: 72 * HOUR,
  expiresAt: 168 * HOUR,
  contacts: [
    {
      contactId: "c1",
      name: "Bob",
      decision: "approve",
      rejectReason: null,
      decidedAt: HOUR,
    },
    {
      contactId: "c2",
      name: "Cleo",
      decision: null,
      rejectReason: null,
      decidedAt: null,
    },
  ],
});
let mockRequest: ReturnType<typeof request> | null = null;
const mockCancel = jest.fn(async (_args: unknown) => null);

jest.mock("convex/react", () => ({ useQuery: () => mockRequest }));
jest.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: () => mockCancel,
}));
jest.mock("@/lib/toast", () => ({ toast: jest.fn() }));
jest.mock("@/lib/format", () => ({
  formatDate: (time: number) => `day+${time / 3_600_000}h`,
  formatTime: () => "time",
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    language: "en",
  }),
}));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/surfaces", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Card: ({ children }: { children: React.ReactNode }) => children,
    StatusChip: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});
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

beforeEach(() => {
  mockCancel.mockClear();
  jest.restoreAllMocks();
});

describe("RecoveryRequestCard", () => {
  it("shows a pending request: when, the 72-hour deadline and each answer", () => {
    mockRequest = request("approved_1");
    rtl.render(<RecoveryRequestCard />);
    expect(rtl.screen.getByText("recoveryCenter.request.title")).toBeTruthy();
    expect(
      rtl.screen.getByText(
        'recoveryCenter.request.waiting {"asked":"day+0h · time","deadline":"day+72h · time"}',
      ),
    ).toBeTruthy();
    expect(rtl.screen.getByText("Bob")).toBeTruthy();
    expect(rtl.screen.getByText("socialRecovery.approved")).toBeTruthy();
    expect(rtl.screen.getByText("Cleo")).toBeTruthy();
    expect(rtl.screen.getByText("socialRecovery.waiting")).toBeTruthy();
  });

  it("cancels only once the owner confirms it wasn't them", async () => {
    mockRequest = request("pending");
    let buttons: AlertButton[] = [];
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, b) => {
      buttons = b ?? [];
    });
    rtl.render(<RecoveryRequestCard />);

    rtl.fireEvent.press(rtl.screen.getByText("recoveryCenter.request.notMe"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "recoveryCenter.request.cancelTitle",
      "recoveryCenter.request.cancelBody",
      expect.any(Array),
    );
    expect(mockCancel).not.toHaveBeenCalled();

    buttons.find((b) => b.style === "destructive")?.onPress?.();
    await rtl.waitFor(() => expect(mockCancel).toHaveBeenCalledWith({}));
  });

  it("shows nothing once the request is closed", () => {
    for (const status of ["cancelled", "rejected", "expired", "rotated"]) {
      mockRequest = request(status);
      const { toJSON, unmount } = rtl.render(<RecoveryRequestCard />);
      expect(toJSON()).toBeNull();
      unmount();
    }
  });
});
