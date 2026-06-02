import { useEffect, useRef } from "react";

/**
 * Inactivity auto-lock window (defense-in-depth for the extractable, persisted
 * MasterKey — see master-key-store.ts). After this much wall-clock time with no
 * genuine user activity, the vault locks: the in-memory + persisted MasterKey
 * and the in-memory identity secret are wiped, forcing a re-unlock. Single
 * source of truth — do not hardcode the duration elsewhere.
 */
export const AUTO_LOCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Events that count as "the user is still here" and reset the idle clock.
 * Listened on `window` (capture phase, passive) so they fire regardless of
 * where focus is. `visibilitychange` lets returning to the tab count as
 * activity too.
 */
export const IDLE_ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "visibilitychange",
] as const;

/** Min gap between two timer resets — caps work during input/scroll bursts. */
const ACTIVITY_THROTTLE_MS = 1000;

interface UseIdleTimerOptions {
  /** Called once when the idle timeout elapses with no activity. */
  onIdle: () => void;
  /** When false, no listeners/timers run (e.g. vault already locked). */
  enabled: boolean;
  /** Override only in tests; defaults to the shared constant. */
  timeoutMs?: number;
}

/**
 * Fires `onIdle` after `timeoutMs` of no user activity. Genuine activity
 * (pointer/key/tab-visibility) resets the countdown, throttled so a burst of
 * events does not rearm the timer on every event. KISS: one effect, one timer,
 * one set of listeners — no parallel system.
 */
export function useIdleTimer({
  onIdle,
  enabled,
  timeoutMs = AUTO_LOCK_TIMEOUT_MS,
}: UseIdleTimerOptions): void {
  // Keep the latest onIdle without re-running the effect (and so re-attaching
  // listeners) on every render. Updated in an effect, not during render.
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (enabled === false) return;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout>;
    let lastResetAt = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const onActivity = (event: Event) => {
      // A tab going hidden is not activity; only returning to it is.
      if (event.type === "visibilitychange" && document.hidden) return;
      const now = Date.now();
      if (now - lastResetAt < ACTIVITY_THROTTLE_MS) return;
      lastResetAt = now;
      arm();
    };

    arm();
    for (const type of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, {
        capture: true,
        passive: true,
      });
    }

    return () => {
      clearTimeout(timer);
      for (const type of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true });
      }
    };
  }, [enabled, timeoutMs]);
}
