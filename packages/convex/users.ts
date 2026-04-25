import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { optionalAuth, requireAuth } from "./helpers";
import { createAuditLog } from "./audit";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    return await ctx.db.get(userId);
  },
});

/**
 * Update the user's profile fields (name, phone, avatar).
 * Email is controlled by the auth provider and cannot be changed here.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim() || undefined;
    if (args.phoneNumber !== undefined)
      patch.phoneNumber = args.phoneNumber.trim() || undefined;
    if (args.avatarUrl !== undefined)
      patch.avatarUrl = args.avatarUrl.trim() || undefined;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Lazily set the user's RSA-OAEP keypair used for per-recipient DEK
 * wrapping. The public key is stored in cleartext; the private key is
 * encrypted client-side under the user's master key and stored in
 * `encryptedKeyBundle`. Idempotent: re-running with the same keypair is a
 * no-op; calling with a different public key is rejected to avoid
 * silently invalidating prior wrapped DEKs.
 */
export const setPublicKey = mutation({
  args: {
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (user.publicKey && user.publicKey !== args.publicKey) {
      throw new Error(
        "A different public key is already set for this account"
      );
    }

    await ctx.db.patch(userId, {
      publicKey: args.publicKey,
      encryptedKeyBundle: args.encryptedPrivateKey,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update the user's platform preferences (language, timezone).
 */
export const updatePreferences = mutation({
  args: {
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.language !== undefined) patch.language = args.language;
    if (args.timezone !== undefined) patch.timezone = args.timezone;

    await ctx.db.patch(userId, patch);
  },
});

/**
 * Wipe every record owned by `userId` while preserving the `audit_logs` table
 * (the on-chain trail must outlive the user). Writes a final tamper-evident
 * audit entry BEFORE deletion so the wipe itself is recorded in the chain.
 */
export async function wipeUserData(
  ctx: MutationCtx,
  userId: Id<"users">,
  actor: {
    actorType: "user" | "trusted_contact" | "system" | "ai_assistant";
    actorId: string;
  }
) {
  await createAuditLog(ctx, {
    userId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    action: "account_wipe_executed",
    resourceType: "user",
    resourceId: userId,
  });

  const tablesByUser = [
    "vault_items",
    "trusted_contacts",
    "life_check_configs",
    "life_check_cycles",
    "passive_signals",
    "scenarios",
    "conditional_messages",
    "emergency_cards",
    "notifications",
    "vaults",
  ] as const;

  for (const table of tablesByUser) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }

  const scenarioSteps = await ctx.db
    .query("scenario_steps")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of scenarioSteps) {
    await ctx.db.delete(row._id);
  }

  const accessRequests = await ctx.db
    .query("access_requests")
    .withIndex("by_vault_user", (q) => q.eq("vaultUserId", userId))
    .collect();
  for (const row of accessRequests) {
    await ctx.db.delete(row._id);
  }

  await ctx.db.delete(userId);
}

/**
 * User-initiated permanent deletion. Requires the literal "DELETE"
 * confirmation phrase and that the user has already re-authenticated upstream.
 * `audit_logs` are intentionally preserved (immutable on-chain trail).
 */
export const deleteAccount = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmation !== "DELETE") {
      throw new Error("Confirmation phrase mismatch");
    }
    const userId = await requireAuth(ctx);

    await wipeUserData(ctx, userId, {
      actorType: "user",
      actorId: userId,
    });

    return { success: true };
  },
});
