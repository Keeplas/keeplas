import { useAuthToken } from "@convex-dev/auth/react";

/**
 * Convex Auth session of a JWT: its `sub` claim is "<userId>|<sessionId>".
 * Lets the client recognise its own row in `devices.list` (W04-6 "This
 * device"). Returns null for a missing or malformed token.
 */
export function sessionIdFromToken(token: string | null): string | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" ? (sub.split("|")[1] ?? null) : null;
  } catch {
    return null;
  }
}

/** The signed-in browser's Convex Auth session id. */
export function useSessionId(): string | null {
  return sessionIdFromToken(useAuthToken());
}
