import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const calls: string[] = [];
const signIn = vi.fn();
const signOut = vi.fn(async () => {
  calls.push("signOut");
});
const createSession = vi.fn(async () => {
  calls.push("createSession");
  return { sessionId: "session1", expiresAt: Date.now() + 120_000 };
});
const auth = { isLoading: false, isAuthenticated: false };

vi.mock("convex/react", () => ({
  useConvexAuth: () => auth,
  useQuery: () => undefined,
  useMutation: () => createSession,
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn, signOut }),
}));
vi.mock("@keeplas/crypto/pairing", () => ({
  generateBrowserPairingKeys: async () => ({
    publicKey: "pk",
    secretKey: new Uint8Array(32),
    loginSecret: "secret",
    loginSecretHash: "hash",
  }),
  pairingKeyHash: async () => "keyhash",
  buildPairingQr: () => "https://example.test/link",
  openPairingEnvelope: vi.fn(),
}));
vi.mock("@/lib/device-unlock", () => ({ enrollMethod: vi.fn() }));
vi.mock("@/lib/device-unlock/key-import", () => ({ importMasterKey: vi.fn() }));
vi.mock("@/lib/master-key-context", () => ({
  useMasterKey: () => ({ masterKey: null, setMasterKey: vi.fn() }),
}));
vi.mock("@/lib/passkey", () => ({ registerPasskey: vi.fn() }));
vi.mock("@/lib/use-audited-mutation", () => ({
  useAuditedMutation: () => vi.fn(),
}));
vi.mock("@/lib/use-device-unlock", () => ({ deviceUnlockOwner: vi.fn() }));
vi.mock("@/lib/use-request-context", () => ({
  useRequestContext: () => ({ ip: "1.1.1.1", country: "BE", sig: "s" }),
}));

import { useConnectWithPhone } from "@/app/connect/use-connect-with-phone";

describe("useConnectWithPhone", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("signs out a stale session before opening the pairing session", async () => {
    auth.isAuthenticated = true;
    const { result } = renderHook(() =>
      useConnectWithPhone({ passkeySupported: false }),
    );

    await waitFor(() => expect(result.current.state.phase).toBe("waiting"));
    expect(calls).toEqual(["signOut", "createSession"]);
  });

  it("opens the pairing session directly when signed out", async () => {
    auth.isAuthenticated = false;
    const { result } = renderHook(() =>
      useConnectWithPhone({ passkeySupported: false }),
    );

    await waitFor(() => expect(result.current.state.phase).toBe("waiting"));
    expect(calls).toEqual(["createSession"]);
  });
});
