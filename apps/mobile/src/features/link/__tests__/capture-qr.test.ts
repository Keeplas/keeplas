/**
 * @jest-environment node
 */
import { ConvexError } from "convex/values";
import {
  buildCaptureQr,
  CAPTURE_HANDOFF_EXPIRED,
  CAPTURE_HANDOFF_INVALID,
} from "@keeplas/backend/lib/capture_qr";

import { claimCaptureQr } from "../capture-qr";

const ORIGIN = "https://app.keeplas.com";
const claimed = async () => undefined;

describe("claimCaptureQr (W06-7)", () => {
  it("claims a capture QR from the web app", async () => {
    const claim = jest.fn(claimed);
    await expect(
      claimCaptureQr(buildCaptureQr(ORIGIN, "h1"), {
        claim,
        expectedOrigin: ORIGIN,
      }),
    ).resolves.toEqual({ kind: "ok", handoffId: "h1" });
    expect(claim).toHaveBeenCalledWith("h1");
  });

  it("leaves other QR codes to the pairing flow", async () => {
    await expect(
      claimCaptureQr(`${ORIGIN}/link#s=1&h=2`, {
        claim: claimed,
        expectedOrigin: ORIGIN,
      }),
    ).resolves.toEqual({ kind: "other" });
  });

  it("refuses a QR shown by another site", async () => {
    const claim = jest.fn(claimed);
    await expect(
      claimCaptureQr(buildCaptureQr("https://evil.example", "h1"), {
        claim,
        expectedOrigin: ORIGIN,
      }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(claim).not.toHaveBeenCalled();
  });

  it("reports an expired or foreign handoff", async () => {
    const qr = buildCaptureQr(ORIGIN, "h1");
    await expect(
      claimCaptureQr(qr, {
        claim: async () => {
          throw new ConvexError(CAPTURE_HANDOFF_EXPIRED);
        },
        expectedOrigin: ORIGIN,
      }),
    ).resolves.toEqual({ kind: "expired" });
    await expect(
      claimCaptureQr(qr, {
        claim: async () => {
          throw new ConvexError(CAPTURE_HANDOFF_INVALID);
        },
        expectedOrigin: ORIGIN,
      }),
    ).resolves.toEqual({ kind: "invalid" });
  });
});
