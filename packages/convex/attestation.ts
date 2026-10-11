import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, MutationCtx } from "./_generated/server";
import { auditContextValidator, verifyAuditContext } from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { normalizeE164 } from "./lib/phone";

/**
 * Mobile-only sign-up (F8, M09-9). A phone-otp sign-up code is only issued
 * once the genuine Keeplas app on a real device proved itself:
 *
 *   app  createChallenge                         → random challenge (5 min)
 *   app  App Attest / Play Integrity over it
 *   app  attestation_node.verify(...)            → signup grant (10 min)
 *   app  phone_auth.requestPhoneAuthOtp(signup)  → consumes the grant
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const GRANT_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_RATE_LIMIT_MAX = 20; // per IP per hour

export const attestationPlatformValidator = v.union(
  v.literal("ios"),
  v.literal("android"),
  // Simulators / emulators cannot attest. Only accepted when the deployment
  // sets ATTESTATION_SIMULATOR_BYPASS=true (never in production).
  v.literal("simulator"),
);

export const SIGNUP_ATTESTATION_REQUIRED = "SIGNUP_ATTESTATION_REQUIRED";
export const MOBILE_ONLY_SIGNUP = "MOBILE_ONLY_SIGNUP";

/**
 * Sign-up is mobile-only (F8): only `phone-otp` creates accounts, behind an
 * attestation grant. Email + password and email-otp keep signing in until
 * their owners migrate to a phone (M09-7).
 */
export function refuseNonMobileSignUp(flow: unknown) {
  if (flow === "signUp") throw new ConvexError(MOBILE_ONLY_SIGNUP);
}

function randomChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** App: fetch a one-time challenge to attest over. Unauthenticated. */
export const createChallenge = mutation({
  args: { _audit: auditContextValidator },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    await enforceIpRateLimit(
      ctx,
      "attestation_challenge",
      args._audit.ip,
      CHALLENGE_RATE_LIMIT_MAX,
    );
    const challenge = randomChallenge();
    const challengeId = await ctx.db.insert("attestation_challenges", {
      challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return { challengeId, challenge };
  },
});

/** Single use: returns the challenge string and deletes the row. */
export const consumeChallenge = internalMutation({
  args: { challengeId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("attestation_challenges", args.challengeId);
    const row = id ? await ctx.db.get(id) : null;
    if (!row) throw new ConvexError("Invalid or expired challenge");
    await ctx.db.delete(row._id);
    if (row.expiresAt <= Date.now()) {
      throw new ConvexError("Invalid or expired challenge");
    }
    return row.challenge;
  },
});

/** Records a verified attestation for one phone number. */
export const grantSignup = internalMutation({
  args: { phoneNumber: v.string(), platform: attestationPlatformValidator },
  handler: async (ctx, args) => {
    const phone = normalizeE164(args.phoneNumber);
    if (!phone) throw new ConvexError("Invalid phone number");
    await ctx.db.insert("signup_attestations", {
      phoneNumber: phone,
      platform: args.platform,
      expiresAt: Date.now() + GRANT_TTL_MS,
    });
  },
});

/**
 * Consume the signup grant for `phone` or throw. Called before a sign-up
 * OTP is issued, so a web client (which cannot attest) never gets one.
 */
export async function consumeSignupGrant(ctx: MutationCtx, phone: string) {
  const now = Date.now();
  const grants = await ctx.db
    .query("signup_attestations")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
    .collect();
  const live = grants.find((g) => g.expiresAt > now);
  for (const grant of grants) {
    if (grant.expiresAt <= now) await ctx.db.delete(grant._id);
  }
  if (!live) throw new ConvexError(SIGNUP_ATTESTATION_REQUIRED);
  await ctx.db.delete(live._id);
}
