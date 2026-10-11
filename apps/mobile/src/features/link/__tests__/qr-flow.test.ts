/**
 * @jest-environment node
 */
import {
  buildPairingQr,
  generateBrowserPairingKeys,
  pairingKeyHash,
} from "@keeplas/crypto/pairing";

import {
  describeUserAgent,
  evaluatePairingQr,
  formatFingerprint,
  type PairingSession,
} from "../qr-flow";

const ORIGIN = "https://app.keeplas.com";

async function setup() {
  const browser = await generateBrowserPairingKeys();
  const session: PairingSession = {
    browserPublicKey: browser.publicKey,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/129.0 Safari/537.36",
    approxLocation: "FR",
    expiresAt: Date.now() + 120_000,
  };
  const keyHash = await pairingKeyHash(browser.publicKey);
  const qr = buildPairingQr({ sessionId: "abc123", keyHash, origin: ORIGIN });
  return { session, qr, keyHash };
}

const deps = (getSession: (id: string) => Promise<PairingSession | null>) => ({
  getSession,
  keyHash: pairingKeyHash,
  expectedOrigin: ORIGIN,
});

describe("evaluatePairingQr", () => {
  it("accepts a QR whose key hash matches the session key", async () => {
    const { session, qr } = await setup();
    const outcome = await evaluatePairingQr(
      qr,
      deps(async () => session),
    );
    expect(outcome).toMatchObject({
      kind: "ok",
      qr: { sessionId: "abc123", origin: ORIGIN },
    });
  });

  it("flags a substituted browser key (M09-3)", async () => {
    const { session, qr, keyHash } = await setup();
    const other = await generateBrowserPairingKeys();
    const outcome = await evaluatePairingQr(
      qr,
      deps(async () => ({ ...session, browserPublicKey: other.publicKey })),
    );
    expect(outcome.kind).toBe("mismatch");
    if (outcome.kind === "mismatch") {
      expect(outcome.receivedHash).not.toBe(keyHash);
      expect(outcome.receivedHash).toBe(await pairingKeyHash(other.publicKey));
    }
  });

  it("reports an expired or consumed session", async () => {
    const { qr } = await setup();
    await expect(
      evaluatePairingQr(
        qr,
        deps(async () => null),
      ),
    ).resolves.toEqual({
      kind: "expired",
    });
  });

  it("treats junk, other origins and malformed session ids as invalid", async () => {
    const { session, keyHash } = await setup();
    const ok = deps(async () => session);
    await expect(evaluatePairingQr("hello", ok)).resolves.toEqual({
      kind: "invalid",
    });
    const phishing = buildPairingQr({
      sessionId: "abc123",
      keyHash,
      origin: "https://keep1as.com",
    });
    await expect(evaluatePairingQr(phishing, ok)).resolves.toEqual({
      kind: "invalid",
    });
    const qr = buildPairingQr({ sessionId: "bad", keyHash, origin: ORIGIN });
    const throwing = deps(async () => {
      throw new Error("ArgumentValidationError");
    });
    await expect(evaluatePairingQr(qr, throwing)).resolves.toEqual({
      kind: "invalid",
    });
  });
});

describe("labels", () => {
  it("formats the M09-3 fingerprint", () => {
    expect(formatFingerprint("a3f921c788e04b12ffff")).toBe(
      "A3F9 · 21C7 · 88E0 · 4B12",
    );
  });

  it("describes common browsers", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/129.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "macOS" });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0 Safari/537.36 Edg/129.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows" });
    expect(describeUserAgent("curl/8")).toEqual({ browser: null, os: null });
  });
});
