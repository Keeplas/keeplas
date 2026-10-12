import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { sha256Hex } from "./crypto";

export const OTP_MAX_ATTEMPTS = 5;
export const INVALID_CODE = "Invalid code";

type OtpTable =
  | "phone_auth_codes"
  | "email_auth_codes"
  | "phone_verification_codes"
  | "email_verification_codes"
  | "login_otp_codes";

/**
 * Check a submitted 6-digit code against a user's pending codes (newest
 * unexpired one wins). A wrong guess is counted and reported as
 * `{ wrong: true }` instead of thrown: Convex rolls back every write of a
 * mutation that throws, so a limiter that patches then throws never counts.
 * Callers must return (not throw) on `wrong`. Other failures carry no write
 * and throw a ConvexError.
 */
export async function checkOtp<R extends Doc<OtpTable>>(
  ctx: MutationCtx,
  candidates: R[],
  code: string,
): Promise<{ active: R } | { wrong: true }> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new ConvexError("Code must be 6 digits");
  }
  const now = Date.now();
  const active = candidates
    .filter((c) => c.expiresAt > now)
    .sort((a, b) => b._creationTime - a._creationTime)[0];
  if (!active) throw new ConvexError("Code expired or not requested");
  if (active.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ConvexError("Too many attempts. Request a new code.");
  }
  if ((await sha256Hex(trimmed)) !== active.codeHash) {
    await ctx.db.patch(active._id, { attempts: active.attempts + 1 });
    return { wrong: true };
  }
  return { active };
}
