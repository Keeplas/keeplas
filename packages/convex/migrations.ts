import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { folderItems } from "./folders";
import { resolveItemRecipients } from "./helpers";
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
      "access_requests",
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

/**
 * One-shot migration that retires legacy `vault_items` rows carrying the old
 * `encryptedTitle` field with no plaintext `title`. The current schema requires
 * `title: v.string()` and does not declare `encryptedTitle`, so those rows block
 * the strict schema push (Convex rejects both the missing `title` and the
 * unknown `encryptedTitle`). This backfills a placeholder `title` (the original
 * was encrypted and is unrecoverable without the key) and clears
 * `encryptedTitle`.
 *
 * Widen → MIGRATE → narrow: run this while the schema still tolerates the legacy
 * shape (title optional + encryptedTitle optional), BEFORE pushing the strict
 * schema. Idempotent; a no-op once every row has a `title` and no
 * `encryptedTitle`.
 *   npx convex run migrations:migrateVaultItemTitles        # dev
 */
export const migrateVaultItemTitles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("vault_items").collect();
    let migrated = 0;
    for (const row of rows) {
      // `encryptedTitle` is not in the generated types (removed from schema) —
      // read it through a cast for the transitional window.
      const legacy = row as unknown as { encryptedTitle?: string };
      const missingTitle = !row.title || row.title.length === 0;
      if (!missingTitle && legacy.encryptedTitle === undefined) continue;
      await ctx.db.patch(row._id, {
        ...(missingTitle ? { title: "(recovered)" } : {}),
        // Passing `undefined` removes the field from the document.
        ...(legacy.encryptedTitle !== undefined
          ? { encryptedTitle: undefined }
          : {}),
        updatedAt: Date.now(),
      } as unknown as Partial<typeof row>);
      migrated++;
    }
    return { scanned: rows.length, migrated };
  },
});

/**
 * One-shot migration that retires the legacy 60-second "test" check-in cadence.
 * Any `life_check_configs` still on `frequency: "test"` is moved to the safe
 * "weekly" cadence (7-day threshold) with the inactivity clock re-armed from
 * `now`, so it can't fire immediately. MUST run on a deployment BEFORE pushing
 * the schema that drops `v.literal("test")` — otherwise the schema push is
 * rejected, and a leftover "test" config would otherwise trigger in ~60s.
 * Idempotent and a no-op when no "test" config exists:
 *   npx convex run migrations:migrateTestCadence        # dev
 *   npx convex run migrations:migrateTestCadence --prod # prod (run first)
 */
export const migrateTestCadence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const WEEKLY_DAYS = 7;
    const now = Date.now();

    const configs = await ctx.db.query("life_check_configs").collect();
    // `frequency` no longer includes "test" in the generated types, but legacy
    // documents may still carry it until this migration runs — compare as string.
    const stale = configs.filter((c) => (c.frequency as string) === "test");

    for (const config of stale) {
      await ctx.db.patch(config._id, {
        frequency: "weekly",
        inactivityThresholdDays: WEEKLY_DAYS,
        lastActivityAt: now,
        nextCheckAt: now + WEEKLY_DAYS * DAY_MS,
        updatedAt: now,
      });
    }

    return { scanned: configs.length, migrated: stale.length };
  },
});

/**
 * One-shot migration that retires the trust / recipient-only split: every
 * contact is now a trust contact. Clears `contactType` on every row and adds
 * former recipient-only contacts to their owner's default group (trust
 * contacts were auto-added at invite time; recipient-only ones were not).
 *
 * Widen → MIGRATE → narrow: run this while the schema still declares
 * `contactType`, BEFORE pushing the schema that drops it. Idempotent:
 *   npx convex run migrations:migrateContactTypes        # dev
 *   npx convex run migrations:migrateContactTypes --prod # prod
 */
export const migrateContactTypes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("trusted_contacts").collect();
    let migrated = 0;
    for (const row of rows) {
      if (row.contactType === undefined) continue;
      if (
        row.contactType === "recipient_only" &&
        row.invitationStatus !== "revoked"
      ) {
        const group = await ctx.db
          .query("recipient_groups")
          .withIndex("by_user_default", (q) =>
            q.eq("userId", row.userId).eq("isDefault", true),
          )
          .first();
        if (group && !group.memberContactIds.includes(row._id)) {
          await ctx.db.patch(group._id, {
            memberContactIds: [...group.memberContactIds, row._id],
            updatedAt: Date.now(),
          });
        }
      }
      // Passing `undefined` removes the field from the document.
      await ctx.db.patch(row._id, { contactType: undefined });
      migrated++;
    }
    return { scanned: rows.length, migrated };
  },
});

/**
 * Folders became categories: access is set per item, so folder grants end.
 * Deletes every `folder_grants` row and the DEK wraps it gave, except where
 * the contact still receives the item through its own access. Run once after
 * deploying the categories change, before the schema drops the table.
 * Idempotent:
 *   npx convex run migrations:dropFolderGrants        # dev
 *   npx convex run migrations:dropFolderGrants --prod # prod
 */
export const dropFolderGrants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const grants = await ctx.db.query("folder_grants").collect();
    for (const grant of grants) {
      for (const item of await folderItems(ctx, grant.folderId)) {
        const recipients = await resolveItemRecipients(ctx, item, item.userId);
        if (
          item.accessLevel !== "private" &&
          recipients.includes(grant.contactId)
        ) {
          continue;
        }
        const row = await ctx.db
          .query("vault_item_recipient_keys")
          .withIndex("by_item_contact", (q) =>
            q.eq("itemId", item._id).eq("contactId", grant.contactId),
          )
          .first();
        if (row) await ctx.db.delete(row._id);
      }
      await ctx.db.delete(grant._id);
    }
    return grants.length;
  },
});
