/**
 * Where the app must be, from what is known about the session. The root
 * layout guards each route group with exactly one stage.
 *
 *   signedOut  → M08-1 Welcome, sign-up / sign-in
 *   loginOtp   → email accounts: the login-OTP step (requireFullAuth)
 *   setup      → M01-3 passkey, M01-4 vault (no key bundle yet)
 *   needsKit   → account has a vault but this phone holds no key: 24 words
 *   locked     → M08-6 Unlock your vault
 *   migration  → M09-7 Move to phone sign-in (email accounts, D5)
 *   ready      → the app (tabs)
 */
export type Stage =
  | "loading"
  | "signedOut"
  | "loginOtp"
  | "setup"
  | "needsKit"
  | "locked"
  | "migration"
  | "ready";

export interface StageInputs {
  authLoading: boolean;
  authenticated: boolean;
  /** undefined while loading; null when the session no longer resolves. */
  viewer: { hasKeyBundle: boolean } | null | undefined;
  loginOtpRequired: boolean | undefined;
  needsMigration: boolean | undefined;
  migrationDeferred: boolean;
  hasDeviceVault: boolean | undefined;
  unlocked: boolean;
}

export function resolveStage(i: StageInputs): Stage {
  if (i.authLoading) return "loading";
  if (!i.authenticated || i.viewer === null) return "signedOut";
  if (i.viewer === undefined || i.loginOtpRequired === undefined)
    return "loading";
  if (i.loginOtpRequired) return "loginOtp";
  if (!i.viewer.hasKeyBundle) return "setup";
  if (!i.unlocked) {
    if (i.hasDeviceVault === undefined) return "loading";
    return i.hasDeviceVault ? "locked" : "needsKit";
  }
  if (i.needsMigration === undefined) return "loading";
  if (i.needsMigration && !i.migrationDeferred) return "migration";
  return "ready";
}
