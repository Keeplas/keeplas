import type * as Rtl from "@testing-library/react-native";

import { UpgradeSheet } from "@/features/billing/upgrade-sheet";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

const mockContactSupport = jest.fn();
jest.mock("@/lib/support", () => ({
  contactSupport: (...args: unknown[]) => mockContactSupport(...args),
}));
const mockPurchase = jest.fn();
jest.mock("@/features/billing/purchases", () => ({
  describePurchaseError: () => ({ kind: "failed", code: "2" }),
  getLifetimePrice: () => Promise.resolve("$119.00"),
  purchaseLifetime: () => mockPurchase(),
  restoreLifetime: () => Promise.resolve(false),
}));
jest.mock("@/providers/session-provider", () => ({
  useViewer: () => ({ _id: "user1" }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/sheet", () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/surfaces", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Callout: ({ text }: { text: string }) => <Text>{text}</Text>,
    Card: ({ children }: { children: React.ReactNode }) => children,
    IconBadge: () => null,
    IconTile: () => null,
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

beforeEach(() => jest.clearAllMocks());

function renderSheet() {
  const onDismiss = jest.fn();
  const onLeave = jest.fn();
  rtl.render(<UpgradeSheet visible onDismiss={onDismiss} onLeave={onLeave} />);
  return { onDismiss, onLeave };
}

it("offers support with the store error when the payment fails", async () => {
  mockPurchase.mockRejectedValue(new Error("store"));
  const { onDismiss, onLeave } = renderSheet();

  rtl.fireEvent.press(await rtl.screen.findByText("upgrade.pay"));
  rtl.fireEvent.press(await rtl.screen.findByText("support.title"));

  expect(onDismiss).toHaveBeenCalled();
  expect(onLeave).toHaveBeenCalled();
  expect(mockContactSupport).toHaveBeenCalledWith(
    "Lifetime ios: failed (code 2)",
    "billing",
  );
});

it("doesn't offer support while nothing failed", async () => {
  renderSheet();
  await rtl.screen.findByText("upgrade.pay");
  expect(rtl.screen.queryByText("support.title")).toBeNull();
});
