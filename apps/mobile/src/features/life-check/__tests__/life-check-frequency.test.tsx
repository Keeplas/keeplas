import { Alert, type AlertButton } from "react-native";
import type * as Rtl from "@testing-library/react-native";

import LifeCheck from "@/app/(app)/life-check";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

const mockConfig = {
  frequency: "monthly",
  activeChannels: [
    { type: "push", order: 0, isEnabled: true },
    { type: "whatsapp", order: 1, isEnabled: false },
    { type: "email", order: 2, isEnabled: true },
  ],
  travelModeEnabled: false,
  nextCheckAt: Date.now() + 86_400_000,
  paused: false,
};
let mockQueried: typeof mockConfig | null = mockConfig;
let mockPending: { quorumReached?: boolean; gracePeriodEndsAt?: number }[] = [];
const mockSave = jest.fn(async (_args: unknown) => ({ configId: "c1" }));

jest.mock("convex/react", () => ({
  useQuery: (ref: unknown) =>
    jest.requireActual("convex/server").getFunctionName(ref) ===
    "access_requests:getPendingRequests"
      ? mockPending
      : mockQueried,
}));
jest.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: () => mockSave,
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string, params?: object) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    language: "en",
  }),
}));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("@/lib/toast", () => ({ toast: jest.fn() }));
jest.mock("@/components/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/components/nav-bar", () => ({ NavBar: () => null }));
jest.mock("@/features/life-check/countdown", () => ({ Countdown: () => null }));
jest.mock("@/features/people/release-quorum-warning", () => ({
  ReleaseQuorumWarning: () => null,
}));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("@/components/screen", () => ({
  Screen: ({ children, footer }: { children: unknown; footer: unknown }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock("@/components/surfaces", () => ({
  Callout: () => null,
  Card: ({ children }: { children: unknown }) => children,
  ListRow: () => null,
  StatusChip: () => null,
}));
jest.mock("@/components/controls", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    Radio: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
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
  mockSave.mockClear();
  mockPending = [];
  // Confirm the change at once.
  jest
    .spyOn(Alert, "alert")
    .mockImplementation((_title, _body, buttons?: AlertButton[]) =>
      buttons?.at(-1)?.onPress?.(),
    );
});

async function choose(label: string) {
  rtl.render(<LifeCheck />);
  rtl.fireEvent.press(rtl.screen.getByText(label));
  await rtl.waitFor(() => expect(mockSave).toHaveBeenCalled());
}

describe("Life check frequency", () => {
  it("keeps the per-channel choices when the frequency changes", async () => {
    mockQueried = mockConfig;
    await choose("frequency.weekly");
    expect(mockSave).toHaveBeenCalledWith({
      frequency: "weekly",
      activeChannels: mockConfig.activeChannels,
    });
  });

  it("turns every channel on for a first setup", async () => {
    mockQueried = null;
    rtl.render(<LifeCheck />);
    rtl.fireEvent.press(rtl.screen.getByText("succession.cta"));
    rtl.fireEvent.press(rtl.screen.getByText("frequency.quarterly"));
    await rtl.waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave).toHaveBeenCalledWith({
      frequency: "quarterly",
      activeChannels: [
        { type: "push", order: 0, isEnabled: true },
        { type: "whatsapp", order: 1, isEnabled: true },
        { type: "email", order: 2, isEnabled: true },
      ],
    });
  });
});

describe("Life check during an emergency access grace window", () => {
  const endsAt = Date.now() + 48 * 3_600_000;

  it("shows that emergency access is in progress and when it opens", () => {
    mockQueried = { ...mockConfig, nextCheckAt: Date.now() - 86_400_000 };
    mockPending = [{ quorumReached: true, gracePeriodEndsAt: endsAt }];
    rtl.render(<LifeCheck />);

    expect(rtl.screen.getByText("lifeCheck.grace.title")).toBeTruthy();
    expect(
      rtl.screen.getByText(/^lifeCheck\.grace\.body \{"date":/),
    ).toBeTruthy();
    expect(rtl.screen.queryByText("lifeCheck.nextCheckIn")).toBeNull();
  });

  it("cancels it with the I'm okay check-in", async () => {
    mockQueried = mockConfig;
    mockPending = [{ quorumReached: true, gracePeriodEndsAt: endsAt }];
    rtl.render(<LifeCheck />);

    rtl.fireEvent.press(rtl.screen.getByText("lifeCheck.grace.cancel"));
    await rtl.waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({ method: "tap" }),
    );
  });

  it("keeps the regular countdown while contacts have not reached quorum", () => {
    mockQueried = mockConfig;
    mockPending = [{ quorumReached: false }];
    rtl.render(<LifeCheck />);

    expect(rtl.screen.getByText("lifeCheck.nextCheckIn")).toBeTruthy();
    expect(rtl.screen.queryByText("lifeCheck.grace.title")).toBeNull();
  });
});
