import type { Href } from "expo-router";

/**
 * Where the app must be, from what is known about the session. The root
 * layout guards each route group with exactly one stage.
 *
 *   signedOut  → M08-1 Welcome, sign-up / sign-in
 *   loginOtp   → email accounts: the login-OTP step (requireFullAuth)
 *   totp       → accounts with an authenticator app: its code (requireFullAuth)
 *   newNumber  → signed in with the 24 words after losing the number: set a
 *                new one before anything else
 *   setup      → M01-3 passkey, M01-4 vault (no key bundle yet)
 *   needsKit   → account has a vault but this phone holds no key: restore
 *                from iCloud / Google, else the other ways back in
 *   locked     → M08-6 Unlock my vault
 *   migration  → M09-7 Move to phone sign-in (email accounts, D5)
 *   ready      → the app (tabs)
 */
export type Stage =
  | "loading"
  | "signedOut"
  | "loginOtp"
  | "totp"
  | "newNumber"
  | "setup"
  | "needsKit"
  | "locked"
  | "migration"
  | "ready";

/** First screen of each stage: app/index.tsx and the header logo go there. */
export const STAGE_HOME: Record<Exclude<Stage, "loading">, Href> = {
  signedOut: "/welcome",
  loginOtp: "/login-otp",
  totp: "/login-totp",
  newNumber: "/new-number",
  setup: "/passkey",
  needsKit: "/cloud-restore",
  locked: "/unlock",
  migration: "/move-to-phone",
  ready: "/home",
};

export interface StageInputs {
  authLoading: boolean;
  authenticated: boolean;
  /** undefined while loading; null when the session no longer resolves. */
  viewer: { hasKeyBundle: boolean } | null | undefined;
  loginOtpRequired: boolean | undefined;
  totpRequired: boolean | undefined;
  /** false unless a 24-word sign-in still has to set the new number. */
  newNumberPending: boolean | undefined;
  needsMigration: boolean | undefined;
  migrationDeferred: boolean;
  hasDeviceVault: boolean | undefined;
  unlocked: boolean;
  /** Sign-out started: leave now, the server sign-out may be slow or offline. */
  signingOut: boolean;
}

export function resolveStage(i: StageInputs): Stage {
  if (i.signingOut) return "signedOut";
  if (i.authLoading) return "loading";
  if (!i.authenticated || i.viewer === null) return "signedOut";
  if (
    i.viewer === undefined ||
    i.loginOtpRequired === undefined ||
    i.totpRequired === undefined ||
    i.newNumberPending === undefined
  )
    return "loading";
  if (i.loginOtpRequired) return "loginOtp";
  if (i.totpRequired) return "totp";
  if (i.newNumberPending) return "newNumber";
  if (!i.viewer.hasKeyBundle) return "setup";
  if (!i.unlocked) {
    if (i.hasDeviceVault === undefined) return "loading";
    return i.hasDeviceVault ? "locked" : "needsKit";
  }
  if (i.needsMigration === undefined) return "loading";
  if (i.needsMigration && !i.migrationDeferred) return "migration";
  return "ready";
}
