"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { STORAGE_KEYS } from "./storage-keys";

const FRONTEND_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Pings the backend with an `app_activity` passive signal once per session
 * window (1h). Server-side throttling is the source of truth — this client
 * throttle only avoids unnecessary network calls. Any successful navigation
 * inside the hub counts as activity and resets the inactivity clock.
 */
export function usePassiveSignal(enabled: boolean) {
  const recordSignal = useMutation(api.passive_signals.recordSignal);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const lastRaw = window.localStorage.getItem(
      STORAGE_KEYS.passiveSignalLastSentAt,
    );
    const lastSent = lastRaw ? Number(lastRaw) : 0;
    if (Date.now() - lastSent < FRONTEND_THROTTLE_MS) return;

    recordSignal({ signalType: "app_activity" })
      .then(() => {
        window.localStorage.setItem(
          STORAGE_KEYS.passiveSignalLastSentAt,
          String(Date.now()),
        );
      })
      .catch(() => {
        // Network or auth hiccup — ignore. Server-side throttle covers retries.
      });
  }, [enabled, recordSignal]);
}
