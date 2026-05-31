import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { deleteBlob } from "./lib/storage";

/**
 * DANGER — full data wipe. Deletes every document in every application table
 * (and every auth table), plus every stored blob. Internal-only: not callable
 * from clients, only via:
 *   npx convex run migrations:wipeAllData '{"confirm":"WIPE"}'
 *
 * Used to reset a deployment to a pristine empty state — e.g. before deploying
 * a schema that drops fields/tables (Convex rejects a schema push while
 * documents still carry a removed field/table). Idempotent.
 */
export const wipeAllData = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    if (args.confirm !== "WIPE") {
      throw new Error('Pass { "confirm": "WIPE" } to run the full data wipe.');
    }

    // Application tables + auth-framework tables (@convex-dev/auth).
    const tables = [
      "notifications",
      "support_tickets",
      "audit_logs",
      "ip_rate_limits",
      "recovery_shard_submissions",
      "access_requests",
      "push_subscriptions",
      "life_check_cycles",
      "life_check_configs",
      "trusted_contacts",
      "vault_item_files",
      "vault_item_recipient_keys",
      "recipient_groups",
      "vault_items",
      "vaults",
      "auth_session_login_otp",
      "login_otp_codes",
      "auth_session_totp",
      "totp_secrets",
      "webauthn_challenges",
      "passkey_credentials",
      "email_auth_codes",
      "email_verification_codes",
      "phone_auth_codes",
      "phone_verification_codes",
      "users",
      "authAccounts",
      "authRefreshTokens",
      "authSessions",
      "authVerificationCodes",
      "authVerifiers",
      "authRateLimits",
    ] as const;

    const deletedByTable: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      deletedByTable[table] = rows.length;
    }

    // Drop every stored blob so the wipe leaves no orphaned storage.
    const blobs = await ctx.db.system.query("_storage").collect();
    for (const blob of blobs) {
      await deleteBlob(ctx, blob._id);
    }

    return { deletedByTable, blobsDeleted: blobs.length };
  },
});

/**
 * Targeted wipe of `audit_logs` only — leaves all other data intact.
 *
 * Required before deploying the SHA-256 audit chain (the hash algorithm
 * changed, so any entry written under the legacy 32-bit hash would break
 * end-to-end chain verification). Use this instead of the full wipe when the
 * deployment holds data you want to keep. Internal-only:
 *   npx convex run migrations:wipeAuditLogs '{"confirm":"WIPE"}' --prod
 */
export const wipeAuditLogs = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    if (args.confirm !== "WIPE") {
      throw new Error('Pass { "confirm": "WIPE" } to clear the audit log.');
    }
    const rows = await ctx.db.query("audit_logs").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length };
  },
});
