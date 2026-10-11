import { ConvexError } from "convex/values";

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
