import type * as Rtl from "@testing-library/react-native";

import { LifeCheckPrompt } from "../life-check-prompt";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const { render } = jest.requireActual<typeof Rtl>(
  "@testing-library/react-native",
);

const mockButtons: { label: string; variant?: string }[] = [];
jest.mock("@/components/button", () => ({
  Button: (props: { label: string; variant?: string }) => {
    mockButtons.push(props);
    return null;
  },
}));
jest.mock("@/components/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/components/screen", () => ({
  Screen: ({ children, footer }: { children: unknown; footer: unknown }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock("@/components/surfaces", () => ({ Callout: () => null }));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));
jest.mock("../../../../assets/illustrations/branch.svg", () => () => null);
jest.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: () => jest.fn(),
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  mockButtons.length = 0;
});

describe("LifeCheckPrompt", () => {
  it("draws the remind-me-later action on its own surface, readable over the landscape", () => {
    render(<LifeCheckPrompt missed={false} />);
    const later = mockButtons.find((b) => b.label === "lifeCheck.prompt.later");
    expect(later?.variant).toBe("secondary");
  });

  it("offers no postponing once a check-in was missed", () => {
    render(<LifeCheckPrompt missed />);
    expect(mockButtons.map((b) => b.label)).toEqual([
      "lifeCheck.prompt.missedConfirm",
    ]);
  });
});
