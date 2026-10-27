import { ConvexError } from "convex/values";
import type { PasskeyError } from "react-native-passkey";

/** Readable message from a Convex / native error (ConvexError data first). */
export function errorText(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string"
      ? error.data
      : JSON.stringify(error.data);
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * The server's own message (a ConvexError with string data), for a toast
 * description. Undefined otherwise: native and unexpected errors carry
 * request IDs or OS codes, which mean nothing to the user.
 */
export function serverMessage(error: unknown): string | undefined {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : undefined;
}

/**
 * Sign-in code failures. The server reports "Invalid code", "Code expired
 * or not requested" and "Too many attempts. Request a new code." (as
 * ConvexError or a returned result, see packages/convex/lib/otp.ts); anything
 * unrecognised counts as a wrong code, the safest reading for the user.
 */
export type CodeFailure = "wrong" | "expired" | "tooMany";

export function classifyCodeError(error: unknown): CodeFailure {
  const text = errorText(error).toLowerCase();
  if (text.includes("too many")) return "tooMany";
  if (text.includes("expired") || text.includes("not requested"))
    return "expired";
  return "wrong";
}

function isPasskeyError(error: unknown): error is PasskeyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "string"
  );
}

/**
 * A failed passkey creation. react-native-passkey rejects with a plain
 * `{ error, message }` (error = "UserCancelled", "RequestFailed", …), the
 * server with an Error. `null` when the user closed the prompt; otherwise the
 * detail support needs to diagnose it (e.g. an unverified associated domain).
 */
export function passkeyFailure(error: unknown): string | null {
  if (!isPasskeyError(error)) return errorText(error);
  if (error.error === "UserCancelled") return null;
  return `${error.error}: ${error.message}`;
}
