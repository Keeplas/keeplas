import { v } from "convex/values";
import { internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { optionalAuth } from "./helpers";
import { createAuditLog } from "./audit";
import { requireEnv } from "./lib/require_env";

const TOPIC = v.union(
  v.literal("general"),
  v.literal("security"),
  v.literal("billing"),
  v.literal("recovery"),
  v.literal("feature_request"),
  v.literal("other"),
);

const TOPIC_LABELS: Record<string, string> = {
  general: "General question",
  security: "Security concern",
  billing: "Billing & subscription",
  recovery: "Recovery & vault access",
  feature_request: "Feature request",
  other: "Other",
};

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

    await ctx.scheduler.runAfter(0, internal.support.notifySupportInbox, {
      name,
      email,
      topic: args.topic,
      subject,
      message,
    });

    return { ticketId };
  },
});

/**
 * Forwards a freshly submitted ticket to the team inbox via Resend.
 * No-ops gracefully when credentials are missing so dev environments still work.
 */
export const notifySupportInbox = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    topic: TOPIC,
    subject: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const inbox = process.env.SUPPORT_INBOX_EMAIL;
    if (!apiKey || !inbox) return "support_inbox_not_configured";

    // Contact form has its own sender (e.g. form@keeplas.com) so it stays
    // distinct from transactional senders like noreply@keeplas.com used for
    // OTP / Life Check. Falls back to RESEND_FROM_EMAIL when unset.
    const from =
      process.env.SUPPORT_FROM_EMAIL ?? requireEnv("RESEND_FROM_EMAIL");
    const topicLabel = TOPIC_LABELS[args.topic] ?? args.topic;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [inbox],
        reply_to: args.email,
        subject: `[${topicLabel}] ${args.subject}`,
        html: ticketEmailHtml(args),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`resend ${res.status}: ${text.slice(0, 160)}`);
    }
    return "sent";
  },
});

function ticketEmailHtml(args: {
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
}) {
  const topicLabel = TOPIC_LABELS[args.topic] ?? args.topic;
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:560px;margin:auto;padding:24px">
<h2 style="margin:0 0 16px">New support ticket</h2>
<p style="margin:0 0 8px"><strong>From:</strong> ${escapeHtml(args.name)} &lt;${escapeHtml(args.email)}&gt;</p>
<p style="margin:0 0 8px"><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
<p style="margin:0 0 16px"><strong>Subject:</strong> ${escapeHtml(args.subject)}</p>
<div style="white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:16px">${escapeHtml(args.message)}</div>
<p style="color:#666;font-size:13px;margin-top:24px">Reply directly to this email to respond to ${escapeHtml(args.email)}.</p>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
