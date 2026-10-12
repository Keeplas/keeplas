import { ConvexError } from "convex/values";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auditedMutation } from "./audit";
import { optionalAuth, requireFullAuth } from "./helpers";
import { endSessions } from "./lib/sessions";

/**
 * Email → phone migration for existing accounts (D5, M09-7 / M09-8).
 * Steps: verify a phone (phone_verification.*), create a passkey
 * (webauthn.*), install the app (devices.register from the phone), then
 * `finalize` turns email + password sign-in off for good.
 */

// Providers that sign in with an email; removed by `finalize`.
const EMAIL_PROVIDERS = ["password", "email-otp"] as const;

async function migrationState(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const emailAccounts = await Promise.all(
    EMAIL_PROVIDERS.map((provider) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", provider),
        )
        .first(),
    ),
  );
  const phoneAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "phone-otp"),
    )
    .first();
  const passkey = await ctx.db
    .query("passkey_credentials")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const devices = await ctx.db
    .query("devices")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return {
    emailAccounts: emailAccounts.filter((a) => a !== null),
    phoneVerified: !!user?.phoneNumberVerifiedAt && phoneAccount !== null,
    hasPasskey: passkey !== null,
    hasMobileDevice: devices.some(
      (d) => d.kind !== "web" && d.revokedAt === undefined,
    ),
  };
}

/** Checklist for M09-7; `null` when signed out. */
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const state = await migrationState(ctx, userId);
    return {
      needsMigration: state.emailAccounts.length > 0,
      phoneVerified: state.phoneVerified,
      hasPasskey: state.hasPasskey,
      hasMobileDevice: state.hasMobileDevice,
    };
  },
});

/**
 * M09-8: once phone, passkey and app are in place, delete the email sign-in
 * accounts (the email stays on the profile for receipts) and end every other
 * session, so the old password no longer works anywhere.
 */
export const finalize = auditedMutation({
  action: "user.signin.migrated_to_phone",
  resourceType: "user",
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const state = await migrationState(ctx, userId);
    if (!state.phoneVerified || !state.hasPasskey || !state.hasMobileDevice) {
      throw new ConvexError("MIGRATION_STEPS_INCOMPLETE");
    }
    for (const account of state.emailAccounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    await endSessions(ctx, userId, await getAuthSessionId(ctx));

    const user = await ctx.db.get(userId);
    const kept = (user?.authProviders ?? []).filter((p) => p === "totp");
    await ctx.db.patch(userId, {
      authProviders: ["phone", "passkey", ...kept],
      updatedAt: Date.now(),
    });
  },
});
