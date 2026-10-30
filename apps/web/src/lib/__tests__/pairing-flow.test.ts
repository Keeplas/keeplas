import { describe, expect, it } from "vitest";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  initialPairingState,
  pairingReducer,
  type PairingState,
} from "../pairing-flow";

const sessionId = "session1" as Id<"pairing_sessions">;
const waiting: PairingState = {
  phase: "waiting",
  sessionId,
  expiresAt: 1_000,
  qrUrl: "https://app.keeplas.com/link#s=session1&h=abc",
  code: "482913",
};

describe("pairingReducer", () => {
  it("shows the QR once the session is created", () => {
    expect(
      pairingReducer(initialPairingState, {
        type: "created",
        sessionId,
        expiresAt: 1_000,
        qrUrl: waiting.phase === "waiting" ? waiting.qrUrl : "",
        code: "482913",
      }),
    ).toEqual(waiting);
  });

  it("follows the phone approval through sign-in and unlock", () => {
    const signingIn = pairingReducer(waiting, {
      type: "status",
      status: "approved",
    });
    expect(signingIn).toEqual({ phase: "signingIn", sessionId });
    const unlocking = pairingReducer(signingIn, { type: "signedIn" });
    expect(unlocking).toEqual({ phase: "unlocking", sessionId });
    expect(pairingReducer(unlocking, { type: "linked" })).toEqual({
      phase: "done",
    });
  });

  it("ends on the phone's decline or the session expiry", () => {
    expect(
      pairingReducer(waiting, { type: "status", status: "rejected" }),
    ).toEqual({ phase: "rejected" });
    expect(
      pairingReducer(waiting, { type: "status", status: "expired" }),
    ).toEqual({ phase: "expired" });
  });

  it("ignores status updates once the QR screen is left", () => {
    const unlocking: PairingState = { phase: "unlocking", sessionId };
    expect(
      pairingReducer(unlocking, { type: "status", status: "consumed" }),
    ).toBe(unlocking);
    expect(
      pairingReducer(unlocking, { type: "status", status: "expired" }),
    ).toBe(unlocking);
  });

  it("treats a session consumed by someone else as an error", () => {
    expect(
      pairingReducer(waiting, { type: "status", status: "consumed" }),
    ).toEqual({ phase: "error" });
  });

  it("fails before the browser is linked, not after", () => {
    expect(pairingReducer(waiting, { type: "failed" })).toEqual({
      phase: "error",
    });
    const done: PairingState = { phase: "done" };
    expect(pairingReducer(done, { type: "failed" })).toBe(done);
  });

  it("restarts only from a terminal failure", () => {
    for (const phase of ["expired", "rejected", "error"] as const) {
      expect(pairingReducer({ phase }, { type: "restart" })).toBe(
        initialPairingState,
      );
    }
    expect(pairingReducer(waiting, { type: "restart" })).toBe(waiting);
  });
});
