/**
 * Vault auto-lock policy. The phone locks sooner than the web (20 min idle):
 * a phone is easier to pick up than a desk computer.
 */
export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const BACKGROUND_GRACE_MS = 30 * 1000;
export const HELD_GRACE_MS = 10 * 60 * 1000;

/**
 * A moment read from two clocks. The wall clock keeps counting while the
 * phone sleeps but can be turned back in Settings; the uptime clock
 * (`performance.now()`) cannot be changed but pauses while the phone sleeps.
 */
export interface Instant {
  wall: number;
  uptime: number;
}

export function instantNow(): Instant {
  return { wall: Date.now(), uptime: performance.now() };
}

/**
 * Lock when the app comes back after more than the background grace. The
 * time away is the larger of the two clocks, so neither changing the clock
 * nor the phone sleeping shortens it.
 */
export function shouldLockOnResume(
  backgroundedAt: Instant | null,
  now: Instant,
  held = false,
): boolean {
  if (!backgroundedAt) return false;
  const away = Math.max(
    now.wall - backgroundedAt.wall,
    now.uptime - backgroundedAt.uptime,
  );
  return away > (held ? HELD_GRACE_MS : BACKGROUND_GRACE_MS);
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
