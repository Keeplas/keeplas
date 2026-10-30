import type * as Rtl from "@testing-library/react-native";
import { ConvexError } from "convex/values";

import { useStorageFullPrompt } from "@/features/billing/storage-full";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const rtl = jest.requireActual<typeof Rtl>("@testing-library/react-native");

let mockPlan: "free" | "lifetime" = "free";
jest.mock("@/providers/session-provider", () => ({
  useViewer: () => ({ _id: "user1", plan: mockPlan }),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
const mockToast = jest.fn();
jest.mock("@/lib/toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));
jest.mock("@/features/billing/upgrade-sheet", () => ({
  UpgradeSheet: ({ visible }: { visible: boolean }) => {
    const { Text } = jest.requireActual("react-native");
    return visible ? <Text>upgrade-sheet</Text> : null;
  },
}));

const full = new ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" });

function renderPrompt() {
  let handle: (error: unknown) => boolean = () => false;
  function Host() {
    const prompt = useStorageFullPrompt();
    handle = prompt.handle;
    return prompt.sheet;
  }
  rtl.render(<Host />);
  return (error: unknown) => {
    let handled = false;
    rtl.act(() => {
      handled = handle(error);
    });
    return handled;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan = "free";
});

it("explains a text save refused for storage and offers Lifetime", () => {
  const handle = renderPrompt();

  expect(handle(full)).toBe(true);

  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({ description: "storageFull.body" }),
  );
  expect(rtl.screen.getByText("upgrade-sheet")).toBeTruthy();
});

it("only explains it on Lifetime, with nothing to buy", () => {
  mockPlan = "lifetime";
  const handle = renderPrompt();

  expect(handle(full)).toBe(true);

  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({ description: "storageFull.bodyLifetime" }),
  );
  expect(rtl.screen.queryByText("upgrade-sheet")).toBeNull();
});

it("leaves any other error to the caller", () => {
  const handle = renderPrompt();

  expect(handle(new Error("Network request failed"))).toBe(false);

  expect(mockToast).not.toHaveBeenCalled();
  expect(rtl.screen.queryByText("upgrade-sheet")).toBeNull();
});
