"use client";

import { useEffect, useState } from "react";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function remaining(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MINUTE),
    seconds: Math.floor((ms % MINUTE) / SECOND),
  };
}

interface CountdownProps {
  /** Target timestamp (ms since epoch) to count down to. */
  target: number;
}

/**
 * Live DAYS / HOURS / MINUTES / SECONDS countdown to a target timestamp.
 * Ticks once per second and freezes at zero once the target passes.
 */
export function Countdown({ target }: CountdownProps) {
  const [time, setTime] = useState(() => remaining(target));

  useEffect(() => {
    const id = setInterval(() => setTime(remaining(target)), SECOND);
    return () => clearInterval(id);
  }, [target]);

  const segments = [
    { value: time.days, label: "Days" },
    { value: time.hours, label: "Hours" },
    { value: time.minutes, label: "Minutes" },
    { value: time.seconds, label: "Seconds" },
  ];

  return (
    <div className="flex gap-6 sm:gap-8">
      {segments.map((seg) => (
        <div key={seg.label} className="text-center">
          <p className="text-display-md text-primary tabular-nums">
            {String(seg.value).padStart(2, "0")}
          </p>
          <p className="text-label-md uppercase tracking-wide text-on-surface-variant mt-1">
            {seg.label}
          </p>
        </div>
      ))}
    </div>
  );
}
