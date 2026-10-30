import type * as Rtl from "@testing-library/react-native";

import Scan from "@/app/(app)/scan";
import { setPendingLink } from "../pending-link";

// Loaded eagerly: babel's lazyImports would otherwise load the library inside
// the first test, where its jest hooks can't register.
const { render, waitFor, act } = jest.requireActual<typeof Rtl>(
  "@testing-library/react-native",
);

const LINK = "https://app.keeplas.com/link#s=session1&h=abc&k=secret";
const mockSession = {
  browserPublicKey: "pk",
  userAgent: "Chrome on Windows",
  approxLocation: "RU",
  expiresAt: Date.now() + 120_000,
};
const mockQr = {
  sessionId: "session1",
  keyHash: "a".repeat(32),
  origin: "https://app.keeplas.com",
  qrSecret: "s".repeat(22),
};
const mockApprove = jest.fn(async () => undefined);
const mockReject = jest.fn(async () => undefined);
const mockRouter = { replace: jest.fn(), back: jest.fn() };
let mockApproval: Record<string, unknown> | null = null;

jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("convex/react", () => ({ useConvex: () => ({ query: jest.fn() }) }));
jest.mock("@keeplas/backend/_generated/api", () => ({
  api: {
    pairing: { get: "get", reject: "reject" },
    capture_handoffs: { claim: "claim" },
  },
}));
jest.mock("@keeplas/crypto/pairing", () => ({
  pairingKeyHash: jest.fn(),
  pairingCode: async () => "482913",
}));
jest.mock("@/features/link/qr-flow", () => ({
  evaluatePairingQr: async () => ({
    kind: "ok",
    qr: mockQr,
    session: mockSession,
  }),
}));
jest.mock("@/features/link/capture-qr", () => ({
  claimCaptureQr: async () => ({ kind: "other" }),
}));
jest.mock("@/features/link/use-approve-pairing", () => ({
  PairingKeyMismatch: class extends Error {},
  PresenceDeclined: class extends Error {},
  useApprovePairing: () => mockApprove,
}));
jest.mock("@/features/link/pairing-approval", () => ({
  PairingApproval: (props: Record<string, unknown>) => {
    mockApproval = props;
    return null;
  },
}));
jest.mock("@/features/capture/draft-store", () => ({ draftStore: {} }));
jest.mock("@/features/capture/draft-route", () => ({ draftHref: jest.fn() }));
jest.mock("@/lib/env", () => ({
  env: { appUrl: "https://app.keeplas.com" },
}));
jest.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: () => mockReject,
}));
jest.mock("@/providers/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ colors: {} }),
}));
jest.mock("@/components/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/screen", () => ({
  Screen: ({ children }: { children: unknown }) => <>{children}</>,
}));
jest.mock("@/components/state-message", () => ({
  StateMessage: () => null,
  StateSheet: () => null,
}));
jest.mock("@/components/text", () => ({
  Text: jest.requireActual("react-native").Text,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockApproval = null;
});

describe("pairing link (M03-5)", () => {
  it("opens the approval screen and never approves on its own", async () => {
    setPendingLink(LINK);
    render(<Scan />);
    await waitFor(() => expect(mockApproval).not.toBeNull());
    expect(mockApproval).toMatchObject({
      sessionId: "session1",
      session: mockSession,
      code: "482913",
    });
    expect(mockApprove).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("approves only on Approve, and reports a Decline", async () => {
    setPendingLink(LINK);
    render(<Scan />);
    await waitFor(() => expect(mockApproval).not.toBeNull());
    await act(async () => {
      (mockApproval!.onApprove as () => void)();
    });
    expect(mockApprove).toHaveBeenCalledWith(mockQr, "pk");
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/link-connected" }),
    );

    mockApproval = null;
    setPendingLink(LINK);
    render(<Scan />);
    await waitFor(() => expect(mockApproval).not.toBeNull());
    await act(async () => {
      (mockApproval!.onDecline as () => void)();
    });
    expect(mockReject).toHaveBeenCalledWith({
      sessionId: "session1",
      reason: "declined",
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
