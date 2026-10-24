/**
 * Vault auto-lock policy. The phone locks sooner than the web (20 min idle):
 * a phone is easier to pick up than a desk computer.
 */
export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const BACKGROUND_GRACE_MS = 30 * 1000;
export const HELD_GRACE_MS = 10 * 60 * 1000;

/** Lock when the app comes back after more than the background grace. */
export function shouldLockOnResume(
  backgroundedAt: number | null,
  now: number,
  held = false,
): boolean {
  const grace = held ? HELD_GRACE_MS : BACKGROUND_GRACE_MS;
  return backgroundedAt !== null && now - backgroundedAt > grace;
}

let holds = 0;

export function isLockHeld(): boolean {
  return holds > 0;
}

export function holdLock(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

export async function keepUnlockedWhile<T>(task: () => Promise<T>): Promise<T> {
  const release = holdLock();
  try {
    return await task();
  } finally {
    release();
  }
}
