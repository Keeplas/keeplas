export { cn } from "@keeplas/ui";

const CONVEX_ENVELOPE_RE = /^\[CONVEX [QMA]\(/;
const CONVEX_MESSAGE_RE =
  /Uncaught\s+(?:Convex)?Error:\s*(.+?)(?:\s+at\s+(?:async\s+)?\w+\s*[[(]|\s*Called by client|$)/s;

export function getErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;

  // ConvexError carries structured data on `.data`
  const data = (err as { data?: unknown }).data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }

  // Strip the Convex error envelope to surface only the user-facing message
  if (CONVEX_ENVELOPE_RE.test(err.message)) {
    const match = err.message.match(CONVEX_MESSAGE_RE);
    return match?.[1]?.trim() || fallback;
  }

  return err.message || fallback;
}
