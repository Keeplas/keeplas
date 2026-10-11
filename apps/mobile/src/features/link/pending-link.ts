/**
 * A pairing link opened from outside the app (universal link
 * `https://<app>/link#s=…&h=…`). Held in memory until the vault is unlocked
 * and the scanner can process it, then consumed once.
 */
let pending: string | null = null;

export function setPendingLink(url: string) {
  pending = url;
}

export function takePendingLink(): string | null {
  const url = pending;
  pending = null;
  return url;
}

export function hasPendingLink(): boolean {
  return pending !== null;
}
