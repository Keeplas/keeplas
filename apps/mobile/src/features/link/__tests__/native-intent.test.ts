/**
 * @jest-environment node
 */
import { buildCaptureQr } from "@keeplas/backend/lib/capture_qr";
import { buildPairingQr } from "@keeplas/crypto/pairing";

import { redirectSystemPath } from "@/app/+native-intent";
import { takePendingLink } from "../pending-link";

const ORIGIN = "https://app.keeplas.com";
const TOKEN = "ab".repeat(32);
const open = (path: string) => redirectSystemPath({ path, initial: true });

describe("links that open Keeplas from outside", () => {
  afterEach(() => takePendingLink());

  it("opens the scanner for pairing and capture links", () => {
    const pairing = buildPairingQr({
      origin: ORIGIN,
      sessionId: "session",
      keyHash: "0".repeat(32),
      qrSecret: "A".repeat(22),
    });
    expect(open(pairing)).toBe("/scan");
    expect(takePendingLink()).toBe(pairing);

    const capture = buildCaptureQr(ORIGIN, "h1");
    expect(open(capture)).toBe("/scan");
    expect(takePendingLink()).toBe(capture);
  });

  it("opens an invitation, without any extra parameter", () => {
    expect(open(`${ORIGIN}/invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(open(`keeplas://invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(open(`keeplas:///invite/${TOKEN}?next=/not-me`)).toBe(
      `/invite/${TOKEN}`,
    );
  });

  it("opens the start screen for every other screen and its parameters", () => {
    for (const path of [
      "keeplas://account-phone-verify?phone=%2B15550100",
      "keeplas://not-me?id=x&label=Your%20laptop&when=now",
      "keeplas:///secured?label=x&sessions=9",
      "keeplas://link-blocked?expected=aa&received=bb",
      "keeplas://invite/../not-me",
      `${ORIGIN}/account-email-verify?email=x%40evil.example`,
      "keeplas://",
      "keeplas:///",
    ]) {
      expect(open(path)).toBe("/");
    }
  });

  it("keeps the self-test link for simulator scripting in development", () => {
    expect(open("keeplas://self-test?autorun=1")).toBe(
      "keeplas://self-test?autorun=1",
    );
  });
});
