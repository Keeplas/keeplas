import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers";
import { createAuditLog } from "./audit";

async function assertContactsOwnedByUser(
  ctx: { db: { get: (id: any) => Promise<any> } },
  userId: string,
  contactIds: string[]
) {
  for (const cid of contactIds) {
    const contact = await ctx.db.get(cid);
    if (!contact || contact.userId !== userId) {
      throw new Error("One or more contacts are not owned by you");
    }
  }
}

export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("recipient_groups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getGroup = query({
  args: { groupId: v.id("recipient_groups") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) return null;
    return group;
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    memberContactIds: v.array(v.id("trusted_contacts")),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!args.name.trim()) throw new Error("Group name is required");

    await assertContactsOwnedByUser(ctx, userId, args.memberContactIds);

    if (args.isDefault) {
      const previousDefault = await ctx.db
        .query("recipient_groups")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .first();
      if (previousDefault) {
        await ctx.db.patch(previousDefault._id, {
          isDefault: false,
          updatedAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    const groupId = await ctx.db.insert("recipient_groups", {
      userId,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      color: args.color,
      memberContactIds: args.memberContactIds,
      isDefault: args.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "recipient_group_created",
      resourceType: "recipient_group",
      resourceId: groupId,
      metadata: JSON.stringify({ name: args.name }),
    });

    return groupId;
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("recipient_groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    memberContactIds: v.optional(v.array(v.id("trusted_contacts"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) throw new Error("Group not found");

    if (args.memberContactIds) {
      await assertContactsOwnedByUser(ctx, userId, args.memberContactIds);
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Group name is required");
      patch.name = args.name.trim();
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.memberContactIds !== undefined) {
      patch.memberContactIds = args.memberContactIds;
    }

    await ctx.db.patch(args.groupId, patch);
  },
});

export const setDefaultGroup = mutation({
  args: { groupId: v.id("recipient_groups") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) throw new Error("Group not found");

    const previous = await ctx.db
      .query("recipient_groups")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .first();

    if (previous && previous._id !== args.groupId) {
      await ctx.db.patch(previous._id, {
        isDefault: false,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(args.groupId, {
      isDefault: true,
      updatedAt: Date.now(),
    });
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("recipient_groups") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) throw new Error("Group not found");

    await ctx.db.delete(args.groupId);

    await createAuditLog(ctx, {
      userId,
      actorType: "user",
      actorId: userId,
      action: "recipient_group_deleted",
      resourceType: "recipient_group",
      resourceId: args.groupId,
      metadata: JSON.stringify({ name: group.name }),
    });
  },
});

export const addMember = mutation({
  args: {
    groupId: v.id("recipient_groups"),
    contactId: v.id("trusted_contacts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) throw new Error("Group not found");

    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    if (group.memberContactIds.includes(args.contactId)) return;

    await ctx.db.patch(args.groupId, {
      memberContactIds: [...group.memberContactIds, args.contactId],
      updatedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    groupId: v.id("recipient_groups"),
    contactId: v.id("trusted_contacts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId) throw new Error("Group not found");

    await ctx.db.patch(args.groupId, {
      memberContactIds: group.memberContactIds.filter(
        (id) => id !== args.contactId
      ),
      updatedAt: Date.now(),
    });
  },
});
