import { v } from "convex/values";
import type { PaginationResult } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { SECURITY_LOG_RETENTION_MS, WIPE_ACTION } from "./account_deletion";
import { folderItems } from "./folders";
import { resolveItemRecipients } from "./helpers";
import { claimBlob, deleteAllBlobs, type StorageRef } from "./lib/storage";
import { isLegacyVerifier, verifierDigest } from "./lib/crypto";

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
      "storage_blobs",
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
    const blobsDeleted = await deleteAllBlobs(ctx);

    return { deletedByTable, blobsDeleted };
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
 * Push is now on by default for Life Check. The web app used to mark push as
 * "coming soon" and save it disabled on every edit, so no user ever chose to
 * turn it off: enable it (or add it when missing) on every config. Other
 * channels keep the user's choice. Idempotent:
 *   npx convex run migrations:enableLifeCheckPush        # dev
 *   npx convex run migrations:enableLifeCheckPush --prod # prod
 */
export const enableLifeCheckPush = internalMutation({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("life_check_configs").collect();
    let migrated = 0;
    for (const config of configs) {
      const channels = config.activeChannels;
      const push = channels.find((c) => c.type === "push");
      if (push?.isEnabled) continue;
      const activeChannels = push
        ? channels.map((c) => (c === push ? { ...c, isEnabled: true } : c))
        : [
            ...channels,
            {
              type: "push" as const,
              order: Math.max(0, ...channels.map((c) => c.order)) + 1,
              isEnabled: true,
            },
          ];
      await ctx.db.patch(config._id, { activeChannels, updatedAt: Date.now() });
      migrated++;
    }
    return { scanned: configs.length, migrated };
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

type BlobHolders = PaginationResult<[StorageRef, Id<"users">]>;

/**
 * The rows holding blob handles, oldest first within each table: when two
 * accounts hold one blob, the account with the older file row keeps it. File
 * rows and version snapshots come before avatars, which are fresh uploads.
 */
const BLOB_HOLDERS: ((
  ctx: MutationCtx,
  cursor: string | null,
) => Promise<BlobHolders>)[] = [
  async (ctx, cursor) => {
    const page = await ctx.db
      .query("vault_item_files")
      .paginate({ cursor, numItems: 100 });
    return { ...page, page: page.page.map((f) => [f.storageId, f.userId]) };
  },
  async (ctx, cursor) => {
    const page = await ctx.db
      .query("vault_item_versions")
      .paginate({ cursor, numItems: 100 });
    return {
      ...page,
      page: page.page.flatMap((version) =>
        version.files.map((f): [StorageRef, Id<"users">] => [
          f.storageId,
          version.userId,
        ]),
      ),
    };
  },
  async (ctx, cursor) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor, numItems: 100 });
    return {
      ...page,
      page: page.page.flatMap((user): [StorageRef, Id<"users">][] =>
        user.avatarStorageId ? [[user.avatarStorageId, user._id]] : [],
      ),
    };
  },
];

/**
 * One-shot backfill binding every blob attached before `storage_blobs`
 * existed to its owner, so no other account can claim it. Walks the holder
 * tables a page at a time, rescheduling itself until done; a blob held by two
 * accounts is logged for review. Idempotent — run once after deploying the
 * table:
 *   npx convex run migrations:backfillBlobOwners        # dev
 *   npx convex run migrations:backfillBlobOwners --prod # prod
 */
export const backfillBlobOwners = internalMutation({
  args: {
    step: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { step = 0, cursor = null }) => {
    const { page, isDone, continueCursor } = await BLOB_HOLDERS[step](
      ctx,
      cursor,
    );
    for (const [ref, userId] of page) {
      if (!(await claimBlob(ctx, ref, userId))) {
        console.warn(
          `backfillBlobOwners: blob ${ref} kept by its first holder, also held by ${userId}`,
        );
      }
    }
    const next = isDone
      ? { step: step + 1, cursor: null }
      : { step, cursor: continueCursor };
    if (next.step < BLOB_HOLDERS.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillBlobOwners,
        next,
      );
    }
  },
});

/**
 * One-shot backfill for accounts erased before the security-log purge
 * existed: finds each erasure entry in `audit_logs` and schedules that
 * account's purge 30 days after it (now, if that date has passed). Walks the
 * table a page at a time, rescheduling itself until done. Idempotent — the
 * purge skips living accounts and a second purge of the same account is a
 * no-op. Run once after deploying:
 *   npx convex run migrations:purgeErasedAccountsSecurityLogs        # dev
 *   npx convex run migrations:purgeErasedAccountsSecurityLogs --prod # prod
 */
export const purgeErasedAccountsSecurityLogs = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor = null }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("audit_logs")
      .paginate({ cursor, numItems: 500 });
    for (const log of page) {
      if (log.action !== WIPE_ACTION) continue;
      await ctx.scheduler.runAt(
        log.createdAt + SECURITY_LOG_RETENTION_MS,
        internal.account_deletion.purgeSecurityLog,
        { userId: log.userId },
      );
    }
    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.purgeErasedAccountsSecurityLogs,
        { cursor: continueCursor },
      );
    }
  },
});

/**
 * One-shot backfill replacing every stored 24-word verifier
 * (`recoveryPhraseHash`, `totpResetVerifierHash`) that still holds the
 * verifier itself with its digest (lib/crypto.ts `verifierDigest`). The
 * server already holds the legacy value, so no client is involved and the
 * zero-knowledge model is unchanged; the original verifier keeps matching.
 * Walks `users` a page at a time, rescheduling itself until done.
 * Idempotent — run once after deploying the digest change:
 *   npx convex run migrations:digestRecoveryVerifiers        # dev
 *   npx convex run migrations:digestRecoveryVerifiers --prod # prod
 */
export const digestRecoveryVerifiers = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor = null }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("users")
      .paginate({ cursor, numItems: 200 });
    for (const user of page) {
      const patch: Partial<Doc<"users">> = {};
      if (
        user.recoveryPhraseHash &&
        isLegacyVerifier(user.recoveryPhraseHash)
      ) {
        patch.recoveryPhraseHash = await verifierDigest(
          user.recoveryPhraseHash,
        );
      }
      if (
        user.totpResetVerifierHash &&
        isLegacyVerifier(user.totpResetVerifierHash)
      ) {
        patch.totpResetVerifierHash = await verifierDigest(
          user.totpResetVerifierHash,
        );
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(user._id, patch);
    }
    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.digestRecoveryVerifiers,
        { cursor: continueCursor },
      );
    }
  },
});
