import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, getUserVault } from "./helpers";
import { createAuditLog } from "./audit";

const TRIGGER_TYPE = v.union(
  v.literal("life_check_failure"),
  v.literal("time_based"),
  v.literal("age_based"),
  v.literal("legal_event"),
  v.literal("manual")
);

const STATUS = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("sealed"),
  v.literal("released"),
  v.literal("cancelled")
);

/**
 * List the user's conditional messages plus their backing vault items.
 */
export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const messages = await ctx.db
      .query("conditional_messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const item = await ctx.db.get(msg.vaultItemId);
        return { ...msg, vaultItem: item };
      })
    );

    return enriched;
  },
});

/**
 * Heartbeat / Dead-Man-Switch overall status derived from the user's life check.
 */
export const getDeadManStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const config = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const messages = await ctx.db
      .query("conditional_messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      isActive: !!config?.isActive && !config.travelModeEnabled,
      lastHeartbeatAt: config?.lastCheckAt ?? null,
      nextHeartbeatAt: config?.nextCheckAt ?? null,
      activeMessages: messages.filter((m) => m.status === "active").length,
      draftMessages: messages.filter((m) => m.status === "draft").length,
      curatorsRequired:
        messages[0]?.curatorsRequired ?? 3,
    };
  },
});

/**
 * Create a new conditional message backed by an encrypted vault item.
 */
export const createMessage = mutation({
  args: {
    title: v.string(),
    encryptedContent: v.string(),
    contentHash: v.string(),
    recipients: v.array(v.id("trusted_contacts")),
    triggerType: TRIGGER_TYPE,
    triggerConfig: v.object({
      inactivityDays: v.optional(v.number()),
      releaseDate: v.optional(v.number()),
      recipientAge: v.optional(v.number()),
      legalEventDesc: v.optional(v.string()),
    }),
    curatorsRequired: v.optional(v.number()),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const vault = await getUserVault(ctx, userId);
    if (!vault) throw new Error("Vault not initialized");

    const now = Date.now();

    const vaultItemId = await ctx.db.insert("vault_items", {
      vaultId: vault._id,
      userId,
      category: "conditional_message",
      title: args.title,
      encryptedContent: args.encryptedContent,
      encryptionType: "zero_knowledge",
      contentHash: args.contentHash,
      sharedWithContacts: args.recipients,
      accessLevel: "trusted_only",
      status: "active",
      tags: ["conditional_message"],
      isCritical: true,
      createdAt: now,
      updatedAt: now,
    });

    const messageId = await ctx.db.insert("conditional_messages", {
      userId,
      vaultItemId,
      title: args.title,
      encryptedContent: args.encryptedContent,
      recipients: args.recipients,
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      status: args.status ?? "active",
      encryptionType: "zero_knowledge",
      curatorsRequired: args.curatorsRequired ?? 3,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "conditional_message_created",
      resourceType: "conditional_message",
      resourceId: messageId,
    });

    return { messageId, vaultItemId };
  },
});

/**
 * Update message status (e.g. seal, cancel).
 */
export const setMessageStatus = mutation({
  args: { messageId: v.id("conditional_messages"), status: STATUS },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(args.messageId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: `conditional_message_${args.status}`,
      resourceType: "conditional_message",
      resourceId: args.messageId,
    });

    return { success: true };
  },
});

/**
 * Delete a message (and its underlying vault item).
 */
export const deleteMessage = mutation({
  args: { messageId: v.id("conditional_messages") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(message.vaultItemId);
    await ctx.db.delete(args.messageId);

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "conditional_message_deleted",
      resourceType: "conditional_message",
      resourceId: args.messageId,
    });

    return { success: true };
  },
});
