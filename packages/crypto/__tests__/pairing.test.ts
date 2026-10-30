import { describe, expect, it } from "vitest";
import {
  buildPairingQr,
  generateBrowserPairingKeys,
  openPairingEnvelope,
  pairingCode,
  pairingKeyHash,
  parsePairingQr,
  sealPairingEnvelope,
} from "../src/pairing";
import { generateIdentityKeyPair } from "../src/sig";
import { uint8ToBase64 } from "../src/encoding";

const ORIGIN = "https://app.keeplas.com";
const SESSION = "k17abc";

async function sealed() {
  const browser = await generateBrowserPairingKeys();
  const identity = generateIdentityKeyPair();
  const masterKey = crypto.getRandomValues(new Uint8Array(32));
  const { envelope, approvalSignature } = await sealPairingEnvelope({
    masterKey,
    userId: "user1",
    browserPublicKey: browser.publicKey,
    sessionId: SESSION,
    origin: ORIGIN,
    qrSecret: browser.qrSecret,
    identitySecretKey: identity.secretKey,
  });
  const open = (
    overrides: Partial<Parameters<typeof openPairingEnvelope>[0]>,
  ) =>
    openPairingEnvelope({
      envelope,
      approvalSignature,
      secretKey: browser.secretKey,
      sessionId: SESSION,
      origin: ORIGIN,
      qrSecret: browser.qrSecret,
      identityPublicKey: identity.publicKey,
      userId: "user1",
      ...overrides,
    });
  return { browser, identity, masterKey, envelope, open };
}

describe("pairing", () => {
  it("matches the server key-hash vector (packages/convex/pairing.ts)", async () => {
    const key = uint8ToBase64(new Uint8Array(1184).fill(7));
    expect(await pairingKeyHash(key)).toBe("23d14211db431ee6c40bbd452e048444");
  });

  it("round-trips the QR payload and rejects foreign codes", async () => {
    const { qrSecret } = await generateBrowserPairingKeys();
    const qr = {
      sessionId: SESSION,
      keyHash: "a".repeat(32),
      origin: ORIGIN,
      qrSecret,
    };
    expect(parsePairingQr(buildPairingQr(qr))).toEqual(qr);
    expect(parsePairingQr("https://evil.example/other#s=1&h=2")).toBeNull();
    expect(parsePairingQr("not a url")).toBeNull();
    // A QR without its secret (older app) cannot authenticate the reply.
    expect(
      parsePairingQr(`${ORIGIN}/link#s=${SESSION}&h=${"a".repeat(32)}`),
    ).toBeNull();
  });

  it("shows the same 6-digit code on the browser and the phone", async () => {
    const browser = await generateBrowserPairingKeys();
    const qr = {
      sessionId: SESSION,
      keyHash: await pairingKeyHash(browser.publicKey),
      origin: ORIGIN,
      qrSecret: browser.qrSecret,
    };
    const onBrowser = await pairingCode(qr);
    expect(onBrowser).toMatch(/^\d{6}$/);
    expect(await pairingCode(parsePairingQr(buildPairingQr(qr))!)).toBe(
      onBrowser,
    );
    const other = await generateBrowserPairingKeys();
    expect(await pairingCode({ ...qr, qrSecret: other.qrSecret })).not.toBe(
      onBrowser,
    );
  });

  it("hashes the login secret for the server", async () => {
    const keys = await generateBrowserPairingKeys();
    expect(keys.loginSecretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.loginSecret).not.toContain(keys.loginSecretHash);
  });

  it("delivers the MasterKey to the browser that made the key", async () => {
    const { masterKey, open } = await sealed();
    expect(await open({})).toEqual(masterKey);
  });

  it("rejects a signature from another identity", async () => {
    const { open } = await sealed();
    const other = generateIdentityKeyPair();
    await expect(open({ identityPublicKey: other.publicKey })).rejects.toThrow(
      "signature",
    );
  });

  it("rejects an envelope replayed into another session or origin", async () => {
    const { open } = await sealed();
    await expect(open({ sessionId: "other" })).rejects.toThrow();
    await expect(open({ origin: "https://evil.example" })).rejects.toThrow();
  });

  it("rejects another account and a stale envelope", async () => {
    const { open } = await sealed();
    await expect(open({ userId: "user2" })).rejects.toThrow("another account");
    await expect(open({ now: Date.now() + 10 * 60_000 })).rejects.toThrow(
      "expired",
    );
  });

  it("rejects an envelope the relay sealed itself (no QR secret)", async () => {
    // A malicious server knows the browser key and can sign with a key it
    // serves as the account identity, but never saw the QR secret.
    const { browser, open } = await sealed();
    const relay = generateIdentityKeyPair();
    const forged = await sealPairingEnvelope({
      masterKey: crypto.getRandomValues(new Uint8Array(32)),
      userId: "user1",
      browserPublicKey: browser.publicKey,
      sessionId: SESSION,
      origin: ORIGIN,
      qrSecret: (await generateBrowserPairingKeys()).qrSecret,
      identitySecretKey: relay.secretKey,
    });
    await expect(
      open({ ...forged, identityPublicKey: relay.publicKey }),
    ).rejects.toThrow("QR code");
  });

  it("cannot be opened with another browser key", async () => {
    const { open } = await sealed();
    const other = await generateBrowserPairingKeys();
    await expect(open({ secretKey: other.secretKey })).rejects.toThrow();
  });
});
