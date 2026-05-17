"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cooldown timer for "Resend code" buttons. Adds client-side friction so a
 * code cannot be re-requested in a tight loop (the hard limit is the 3/hour
 * server rate limit). Call `start()` after every successful send/resend.
 */
export function useResendCooldown(seconds = 10) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    setRemaining(seconds);
    timer.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [seconds, stop]);

  useEffect(() => stop, [stop]); // clear on unmount

  return { remaining, active: remaining > 0, start };
}
