/**
 * UserError marks an error whose message is safe to display verbatim to the
 * end user. Anything else thrown from a Convex mutation, action, or client
 * helper must be treated as opaque — surface a generic fallback to the UI and
 * route the details through `safeLog`.
 */
export class UserError extends Error {
  readonly isUserError = true as const;

  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function isUserError(value: unknown): value is UserError {
  return (
    value instanceof UserError ||
    (typeof value === "object" &&
      value !== null &&
      (value as { isUserError?: unknown }).isUserError === true)
  );
}

/**
 * Extract a user-facing message from any thrown value. Returns the original
 * text only for UserError; everything else collapses to a generic string so
 * stack traces, Convex internals, or crypto state never reach the DOM.
 */
export function toUserMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return isUserError(error) ? error.message : fallback;
}

/**
 * Log an error without leaking sensitive context in production. In dev we want
 * the full object (stack, cause, inner errors). In prod we keep only the name
 * and a short message — never the stack, since it can reveal encrypted blob
 * shapes, audit-context internals, or master-key handling code paths.
 */
export function safeLog(
  scope: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${scope}]`, error, extra);
    return;
  }
  const summary =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "Unknown", message: String(error) };
  console.error(`[${scope}]`, summary, extra);
}
