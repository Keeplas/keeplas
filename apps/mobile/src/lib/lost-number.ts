import { deviceStore } from "./device-store";

/**
 * Device-side state of a lost-number recovery (number_change.ts), kept in
 * the Keychain / Keystore (this phone only) because the phone holds no
 * session yet:
 *   claim     the request this phone made and the secret to follow it
 *   pending   a 24-word sign-in still has to set the new number
 */
const CLAIM_KEY = "keeplas.number-change.claim";
const PENDING_KEY = "keeplas.new-number-pending";

export interface NumberChangeClaim {
  requestId: string;
  claimToken: string;
}

export function readClaim(): NumberChangeClaim | null {
  const raw = deviceStore.getItem(CLAIM_KEY);
  return raw ? (JSON.parse(raw) as NumberChangeClaim) : null;
}

export function saveClaim(claim: NumberChangeClaim): void {
  deviceStore.setItem(CLAIM_KEY, JSON.stringify(claim));
}

export function clearClaim(): Promise<void> {
  return deviceStore.removeItem(CLAIM_KEY);
}

export function isNewNumberPending(): boolean {
  return deviceStore.getItem(PENDING_KEY) === "1";
}

export function setNewNumberPending(pending: boolean): void {
  if (pending) deviceStore.setItem(PENDING_KEY, "1");
  else void deviceStore.removeItem(PENDING_KEY);
}
