import { v, ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { internal } from "./_generated/api";
import { auditedMutation } from "./audit";
import {
  optionalAuth,
  requireAuthWithLoginOtp,
  requireFullAuth,
} from "./helpers";
import { requirePhoneProof } from "./session_proofs";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { activePushTokens } from "./devices";
import { getAuthSessionId } from "@convex-dev/auth/server";

/**
 * Cloud backup of the RootKey (D7: on by default, explained at onboarding).
 * Keeplas holds the envelope; the Cloud Backup Key stays in the user's
 * iCloud Keychain / Google Block Store. Turning it off deletes the envelope
 * here; the app deletes the CBK from the platform keychain.
 */

const providerValidator = v.union(v.literal("icloud"), v.literal("google"));
const RESTORE_MAX_PER_HOUR = 5;

/** Owner: on/off and provider, for M07-6 / M08-3. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("cloud_backup_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return row
      ? { enabled: true, provider: row.provider, createdAt: row.createdAt }
      : { enabled: false };
  },
});

/** Turn the backup on (or replace it). One envelope per account. */
export const save = auditedMutation({
  action: "cloud_backup.enabled",
  resourceType: "cloud_backup",
  args: { provider: providerValidator, envelope: v.string() },
  getMetadata: (args) => ({ provider: args.provider }),
  handler: async (ctx, args) => {
    const userId = await requireFullAuth(ctx);
    const existing = await ctx.db
      .query("cloud_backup_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("cloud_backup_envelopes", {
      userId,
      provider: args.provider,
      envelope: args.envelope,
      createdAt: Date.now(),
    });
  },
});

/** Turn the backup off: the envelope is deleted. */
export const disable = auditedMutation({
  action: "cloud_backup.disabled",
  resourceType: "cloud_backup",
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);
    const rows = await ctx.db
      .query("cloud_backup_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

/**
 * New phone: fetch the envelope to open with the restored CBK. The session
 * must have proved the account's number (a WhatsApp code), so a synced
 * passkey or the Apple / Google account alone never restores. Rate-limited,
 * audited, and announced to the owner.
 */
export const restore = auditedMutation({
  action: "cloud_backup.restored",
  resourceType: "cloud_backup",
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthWithLoginOtp(ctx);
    await requirePhoneProof(ctx);
    await enforceIpRateLimit(
      ctx,
      "cloud_backup_restore",
      userId,
      RESTORE_MAX_PER_HOUR,
    );
    const row = await ctx.db
      .query("cloud_backup_envelopes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row) throw new ConvexError("No cloud backup");
    await ctx.db.patch(row._id, { lastRestoredAt: Date.now() });
    const user = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.dispatch.notifyNewDevice, {
      email: user?.email,
      phoneNumber: user?.phoneNumber,
      ownerName: user?.name,
      deviceLabel:
        row.provider === "icloud"
          ? "A phone restored from iCloud"
          : "A phone restored from Google",
      language: user?.language,
      pushTokens: await activePushTokens(
        ctx,
        userId,
        await getAuthSessionId(ctx),
      ),
    });
    return { provider: row.provider, envelope: row.envelope };
  },
});
