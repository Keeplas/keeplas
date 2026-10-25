import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { forgetUnknownPasskey, isUnknownPasskey } from "../passkey";

describe("unknown passkey", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognises the server's unknown-passkey answer", () => {
    expect(isUnknownPasskey(new ConvexError({ code: "UNKNOWN_PASSKEY" }))).toBe(
      true,
    );
    expect(isUnknownPasskey(new Error("Uncaught Error: Unknown passkey"))).toBe(
      true,
    );
    expect(isUnknownPasskey(new ConvexError({ code: "OTHER" }))).toBe(false);
    expect(isUnknownPasskey(new Error("Server Error"))).toBe(false);
  });

  it("asks the browser to forget a passkey the server no longer knows", async () => {
    const signalUnknownCredential = vi.fn(async () => undefined);
    vi.stubGlobal("PublicKeyCredential", { signalUnknownCredential });

    await forgetUnknownPasskey("app.keeplas.com", "cred-1");

    expect(signalUnknownCredential).toHaveBeenCalledWith({
      rpId: "app.keeplas.com",
      credentialId: "cred-1",
    });
  });

  it("does nothing on browsers without the signal API", async () => {
    vi.stubGlobal("PublicKeyCredential", {});
    await expect(
      forgetUnknownPasskey("app.keeplas.com", "cred-1"),
    ).resolves.toBeUndefined();
  });
});
