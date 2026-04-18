import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { optionalAuth } from "./helpers";
import { createAuditLog } from "./audit";

const TOPIC = v.union(
  v.literal("general"),
  v.literal("security"),
  v.literal("billing"),
  v.literal("recovery"),
  v.literal("feature_request"),
  v.literal("other")
);

/**
 * Submit a contact/support ticket. Authentication is optional so logged-out
 * visitors can reach out too (not currently exposed, but the mutation tolerates it).
 */
export const submitTicket = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    topic: TOPIC,
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const subject = args.subject.trim();
    const message = args.message.trim();

    if (!name || !email || !subject || !message) {
      throw new Error("All fields are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email address");
    }
    if (message.length < 10) {
      throw new Error("Message must be at least 10 characters");
    }

    const userId = await optionalAuth(ctx);
    const now = Date.now();

    const ticketId = await ctx.db.insert("support_tickets", {
      userId: userId ?? undefined,
      name,
      email,
      topic: args.topic,
      subject,
      message,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    if (userId) {
      await createAuditLog(ctx, {
        userId,
        actorType: "user",
        actorId: userId,
        action: "support_ticket_submitted",
        resourceType: "support_ticket",
        resourceId: ticketId,
        metadata: JSON.stringify({ topic: args.topic }),
      });
    }

    return { ticketId };
  },
});
