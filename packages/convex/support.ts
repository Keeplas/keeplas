import { v, ConvexError } from "convex/values";
import { internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { optionalAuth } from "./helpers";
import {
  auditContextValidator,
  createAuditLog,
  verifyAuditContext,
} from "./audit";
import { enforceIpRateLimit } from "./lib/rate_limit";
import { requireEnv } from "./lib/require_env";
import { isValidEmail } from "./lib/email";
import { isE164 } from "./lib/phone";

const CHANNEL = v.union(v.literal("email"), v.literal("whatsapp"));

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

/** Tickets one IP may send per hour: each one emails the team inbox. */
export const SUPPORT_TICKETS_PER_IP = 10;
const MAX_LENGTH = { Name: 100, Subject: 200, Message: 5000 };

/**
 * Submit a contact/support ticket. Authentication is optional so signed-out
 * visitors can reach out too (the phone app's help screen, the web contact
 * form). Rate-limited per IP on the sealed `_audit` envelope.
 */
export const submitTicket = mutation({
  args: {
    name: v.string(),
    // Reply-to contact: an email address or a WhatsApp number (E.164). The
    // channel is inferred from its shape.
    contact: v.string(),
    topic: TOPIC,
    subject: v.string(),
    message: v.string(),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    await verifyAuditContext(args._audit);
    const name = args.name.trim();
    const contact = args.contact.trim();
    const subject = args.subject.trim();
    const message = args.message.trim();

    if (!name || !contact || !subject || !message) {
      throw new ConvexError("All fields are required");
    }

    const channel = isValidEmail(contact)
      ? "email"
      : isE164(contact)
        ? "whatsapp"
        : null;
    if (!channel) {
      throw new ConvexError("Enter a valid email address or WhatsApp number");
    }
    if (message.length < 10) {
      throw new ConvexError("Message must be at least 10 characters");
    }
    for (const [field, value] of [
      ["Name", name],
      ["Subject", subject],
      ["Message", message],
    ] as const) {
      if (value.length > MAX_LENGTH[field]) {
        throw new ConvexError(
          `${field} is too long (${MAX_LENGTH[field]} characters at most)`,
        );
      }
    }
    // After validation: a refused ticket sends nothing, and its throw would
    // roll the slot back anyway.
    await enforceIpRateLimit(
      ctx,
      "support_ticket",
      args._audit.ip,
      SUPPORT_TICKETS_PER_IP,
    );

    const email = channel === "email" ? contact.toLowerCase() : undefined;
    const whatsapp = channel === "whatsapp" ? contact : undefined;

    // Intentionally NOT step-up gated: this is a public-tolerant boundary
    // (logged-out visitors may submit a ticket), so it stays on optionalAuth.
    // It writes only a support ticket — no vault content / metadata is read.
    const userId = await optionalAuth(ctx);
    const now = Date.now();

    const ticketId = await ctx.db.insert("support_tickets", {
      userId: userId ?? undefined,
      name,
      email,
      whatsapp,
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
      contact: email ?? whatsapp!,
      channel,
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
    contact: v.string(),
    channel: CHANNEL,
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
    const topicLabel = TOPIC_LABELS[args.topic] ?? args.topic;
    await sendSupportEmail(apiKey, {
      to: inbox,
      // Reply-to only works for email submitters; WhatsApp tickets are
      // answered out of band (see the footer note in the email body).
      replyTo: args.channel === "email" ? args.contact : undefined,
      subject: `[${topicLabel}] ${args.subject}`,
      html: ticketEmailHtml(args),
    });
    return "sent";
  },
});

/**
 * Asks the reviewer (SUPPORT_RECOVERY_EMAIL, kept apart from the general
 * inbox) to check a lost-number request in the admin console: what the
 * requester declared next to what the account holds. Nothing from the vault
 * is known to the server, so nothing from it can appear here.
 */
export const notifyRecoveryReviewer = internalAction({
  args: {
    requestId: v.id("number_change_requests"),
    declaredName: v.string(),
    declaredEmail: v.optional(v.string()),
    message: v.optional(v.string()),
    oldPhone: v.string(),
    newPhone: v.string(),
    accountName: v.optional(v.string()),
    accountEmail: v.optional(v.string()),
    accountCreatedAt: v.number(),
    windowEndsAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const reviewer = process.env.SUPPORT_RECOVERY_EMAIL;
    if (!apiKey || !reviewer) return "recovery_reviewer_not_configured";
    const adminUrl = process.env.ADMIN_APP_URL;
    await sendSupportEmail(apiKey, {
      to: reviewer,
      subject: `[Lost number] ${args.declaredName} — review before ${new Date(args.windowEndsAt).toUTCString()}`,
      html: reviewerEmailHtml({
        ...args,
        link: adminUrl ? `${adminUrl}/recovery/${args.requestId}` : undefined,
      }),
    });
    return "sent";
  },
});

/** Resend POST from the contact-form sender; throws on a failed send. */
async function sendSupportEmail(
  apiKey: string,
  args: { to: string; subject: string; html: string; replyTo?: string },
) {
  // Contact form has its own sender (e.g. form@keeplas.com) so it stays
  // distinct from transactional senders like noreply@keeplas.com used for
  // OTP / Life Check. Falls back to RESEND_FROM_EMAIL when unset.
  const from =
    process.env.SUPPORT_FROM_EMAIL ?? requireEnv("RESEND_FROM_EMAIL");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resend ${res.status}: ${text.slice(0, 160)}`);
  }
}

function reviewerEmailHtml(args: {
  declaredName: string;
  declaredEmail?: string;
  message?: string;
  oldPhone: string;
  newPhone: string;
  accountName?: string;
  accountEmail?: string;
  accountCreatedAt: number;
  windowEndsAt: number;
  link?: string;
}) {
  const row = (label: string, declared: string, recorded: string) =>
    `<tr><td style="padding:6px 8px;color:#666">${label}</td><td style="padding:6px 8px">${escapeHtml(declared)}</td><td style="padding:6px 8px">${escapeHtml(recorded)}</td></tr>`;
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:600px;margin:auto;padding:24px">
<h2 style="margin:0 0 8px">Lost-number request to review</h2>
<p style="margin:0 0 16px">Someone asked to move an account from <strong>${escapeHtml(args.oldPhone)}</strong> to <strong>${escapeHtml(args.newPhone)}</strong>. The owner has been alerted. The change cannot complete before ${escapeHtml(new Date(args.windowEndsAt).toUTCString())}, nor without your approval.</p>
<table style="border-collapse:collapse;width:100%;background:#f6f6f6;border-radius:8px">
<tr><th></th><th style="text-align:left;padding:6px 8px">Declared</th><th style="text-align:left;padding:6px 8px">Account</th></tr>
${row("Name", args.declaredName, args.accountName ?? "—")}
${row("Email", args.declaredEmail ?? "—", args.accountEmail ?? "—")}
${row("Created", "", new Date(args.accountCreatedAt).toUTCString())}
</table>
${args.message ? `<p style="margin:16px 0 4px"><strong>Message</strong></p><div style="white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:16px">${escapeHtml(args.message)}</div>` : ""}
${args.link ? `<p style="margin-top:24px"><a href="${escapeHtml(args.link)}" style="background:#0E2340;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review in the console</a></p>` : ""}
<p style="color:#666;font-size:13px;margin-top:24px">Approve only if the details match. Approving never opens the vault: the owner still needs their cloud backup, 24 words or two contacts.</p>
</body></html>`;
}

function ticketEmailHtml(args: {
  name: string;
  contact: string;
  channel: "email" | "whatsapp";
  topic: string;
  subject: string;
  message: string;
}) {
  const topicLabel = TOPIC_LABELS[args.topic] ?? args.topic;
  const contact = escapeHtml(args.contact);
  const replyNote =
    args.channel === "email"
      ? `Reply directly to this email to respond to ${contact}.`
      : `This ticket was submitted via WhatsApp — reply on WhatsApp to ${contact}.`;
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:560px;margin:auto;padding:24px">
<h2 style="margin:0 0 16px">New support ticket</h2>
<p style="margin:0 0 8px"><strong>From:</strong> ${escapeHtml(args.name)} &lt;${contact}&gt;</p>
<p style="margin:0 0 8px"><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
<p style="margin:0 0 16px"><strong>Subject:</strong> ${escapeHtml(args.subject)}</p>
<div style="white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:16px">${escapeHtml(args.message)}</div>
<p style="color:#666;font-size:13px;margin-top:24px">${replyNote}</p>
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
