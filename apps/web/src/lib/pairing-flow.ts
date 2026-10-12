import type { Id } from "@keeplas/backend/_generated/dataModel";

/**
 * W04-2 "Connect with my phone" state machine (ARCHITECTURE.md § 8). Pure, so
 * the transitions are unit-tested; side effects live in `useConnectWithPhone`.
 *
 *   creating → waiting ─approved→ signingIn → unlocking → passkey → done
 *                 │                                   └──────────→ done
 *                 ├─rejected→ rejected ┐
 *                 └─expired──→ expired ├─restart→ creating
 *   any step before passkey ─failed→ error ┘
 */

export type PairingSessionId = Id<"pairing_sessions">;

/** Values of the reactive `pairing.status` query. */
export type PairingStatus =
  "waiting" | "approved" | "consumed" | "rejected" | "expired";

export type PairingState =
  | { phase: "creating" }
  | {
      phase: "waiting";
      sessionId: PairingSessionId;
      expiresAt: number;
      qrUrl: string;
    }
  | { phase: "signingIn"; sessionId: PairingSessionId }
  | { phase: "unlocking"; sessionId: PairingSessionId }
  | { phase: "passkey"; deviceId: Id<"devices"> }
  | { phase: "done" }
  | { phase: "expired" }
  | { phase: "rejected" }
  | { phase: "error" };

export type PairingEvent =
  | {
      type: "created";
      sessionId: PairingSessionId;
      expiresAt: number;
      qrUrl: string;
    }
  | { type: "status"; status: PairingStatus }
  | { type: "signedIn" }
  | { type: "linked"; deviceId: Id<"devices">; offerPasskey: boolean }
  | { type: "finished" }
  | { type: "failed" }
  | { type: "restart" };

export const initialPairingState: PairingState = { phase: "creating" };

export function pairingReducer(
  state: PairingState,
  event: PairingEvent,
): PairingState {
  switch (event.type) {
    case "created":
      return state.phase === "creating"
        ? {
            phase: "waiting",
            sessionId: event.sessionId,
            expiresAt: event.expiresAt,
            qrUrl: event.qrUrl,
          }
        : state;
    case "status":
      // Only the QR screen follows the server status: once approved, the
      // session moves on to "consumed" because of our own readEnvelope.
      if (state.phase !== "waiting") return state;
      switch (event.status) {
        case "approved":
          return { phase: "signingIn", sessionId: state.sessionId };
        case "rejected":
          return { phase: "rejected" };
        case "expired":
          return { phase: "expired" };
        case "consumed":
          return { phase: "error" };
        case "waiting":
          return state;
      }
      return state;
    case "signedIn":
      return state.phase === "signingIn"
        ? { phase: "unlocking", sessionId: state.sessionId }
        : state;
    case "linked":
      if (state.phase !== "unlocking") return state;
      return event.offerPasskey
        ? { phase: "passkey", deviceId: event.deviceId }
        : { phase: "done" };
    case "finished":
      return state.phase === "passkey" ? { phase: "done" } : state;
    case "failed":
      // Once linked, a failure (e.g. passkey creation) is shown in place: the
      // browser is signed in and unlocked, so restarting would be wrong.
      return state.phase === "passkey" || state.phase === "done"
        ? state
        : { phase: "error" };
    case "restart":
      return state.phase === "expired" ||
        state.phase === "rejected" ||
        state.phase === "error"
        ? initialPairingState
        : state;
  }
}
