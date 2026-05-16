"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requireEnv } from "./lib/require_env";

const CHANNEL_TYPE = v.union(
  v.literal("push"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("sms"),
  v.literal("ivr_call"),
);

interface DispatchContext {
  cycle: Doc<"life_check_cycles">;
  user: Doc<"users">;
  pushSubscriptions: Doc<"push_subscriptions">[];
}

/**
 * Out-of-band sender for a Life Check cycle. Picks the right driver based
 * on `channelType` and gracefully no-ops when the matching API credentials
 * are missing — so cycles still progress through the schedule even in dev
 * environments without external integrations wired up.
 */
export const sendChannel = internalAction({
  args: {
    cycleId: v.id("life_check_cycles"),
    channelType: CHANNEL_TYPE,
  },
  handler: async (ctx, args) => {
    const dispatch: DispatchContext | null = await ctx.runQuery(
      internal.life_check.getDispatchContext,
      { cycleId: args.cycleId },
    );
    if (!dispatch) return;

    if (
      dispatch.cycle.status === "validated" ||
      dispatch.cycle.status === "cancelled"
    ) {
      return;
    }

    let response: string | undefined;

    try {
      switch (args.channelType) {
        case "push":
          response = await sendPush(dispatch);
          break;
        case "email":
          response = await sendEmail(dispatch);
          break;
        case "whatsapp":
          response = await sendWhatsApp(dispatch);
          break;
        default:
          response = "channel_not_supported";
      }
    } catch (error) {
      response = `error:${error instanceof Error ? error.message : String(error)}`;
    }

    await ctx.runMutation(internal.life_check.recordChannelAttempt, {
      cycleId: args.cycleId,
      channelType: args.channelType,
      response,
    });
  },
});

async function sendPush({
  user,
  pushSubscriptions,
}: DispatchContext): Promise<string> {
  if (pushSubscriptions.length === 0) return "no_subscriptions";

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return "vapid_not_configured";

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@keeplas.com",
    vapidPublic,
    vapidPrivate,
  );

  const payload = JSON.stringify({
    title: "Keeplas Life Check",
    body: `${user.name ?? "Hi"}, please confirm you are well.`,
    actionUrl: `${requireEnv("APP_URL")}/life-check`,
  });

  let delivered = 0;
  for (const sub of pushSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      delivered++;
    } catch {
      // Subscription likely expired — skip silently.
    }
  }

  return `delivered:${delivered}/${pushSubscriptions.length}`;
}

async function sendEmail({ user }: DispatchContext): Promise<string> {
  if (!user.email) return "no_email";
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "resend_not_configured";

  const from = requireEnv("RESEND_FROM_EMAIL");
  const verifyUrl = `${requireEnv("APP_URL")}/life-check`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Keeplas — please confirm you are well",
      html: lifeCheckEmailHtml(user.name, verifyUrl),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resend ${res.status}: ${text.slice(0, 120)}`);
  }
  return "sent";
}

/**
 * Single transport for outbound WhatsApp template messages via Infobip.
 * Returns "whatsapp_not_configured" when credentials are absent so callers
 * can degrade gracefully in dev; throws on a non-2xx Infobip response.
 *
 * Infobip API: POST {baseUrl}/whatsapp/1/message/template
 * Auth: `Authorization: App {apiKey}`
 */
async function sendWhatsAppTemplate(args: {
  to: string;
  templateName: string;
  language: string;
  placeholders?: string[];
}): Promise<"sent" | "whatsapp_not_configured"> {
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const apiKey = process.env.INFOBIP_API_KEY;
  const sender = process.env.INFOBIP_WHATSAPP_SENDER;
  if (!baseUrl || !apiKey || !sender) return "whatsapp_not_configured";

  const res = await fetch(
    `${baseUrl.replace(/\/$/, "")}/whatsapp/1/message/template`,
    {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: sender,
            to: args.to.replace(/^\+/, ""),
            content: {
              templateName: args.templateName,
              templateData: {
                body: { placeholders: args.placeholders ?? [] },
              },
              language: args.language,
            },
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`whatsapp ${res.status}: ${text.slice(0, 120)}`);
  }
  return "sent";
}

async function sendWhatsApp({ user }: DispatchContext): Promise<string> {
  if (!user.phoneNumber) return "no_phone";
  return sendWhatsAppTemplate({
    to: user.phoneNumber,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? "keeplas_life_check",
    language: process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
  });
}

/**
 * Out-of-band delivery of a 6-digit OTP via WhatsApp (Infobip transport).
 * Uses an authentication-category template (configurable via
 * WHATSAPP_OTP_TEMPLATE_NAME) with the code as the body placeholder. Falls
 * back to a console log in dev when credentials are missing so manual
 * testing remains possible.
 */
export const sendWhatsAppOtp = internalAction({
  args: {
    phoneNumber: v.string(),
    code: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await sendWhatsAppTemplate({
      to: args.phoneNumber,
      templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "keeplas_otp",
      language: process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? "en",
      placeholders: [args.code],
    });
    if (result === "whatsapp_not_configured") {
      console.warn(
        `[whatsapp_otp] credentials missing; OTP for ${args.phoneNumber} = ${args.code}`,
      );
    }
    return result;
  },
});

function lifeCheckEmailHtml(name: string | undefined, url: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:480px;margin:auto;padding:24px">
<p>${greeting}</p>
<p>We have not seen any activity from you on Keeplas in a while. Please confirm you are well so your continuity protocol stays paused.</p>
<p style="margin:32px 0"><a href="${url}" style="display:inline-block;padding:12px 24px;background:#0b1f3b;color:#fff;text-decoration:none;border-radius:8px">I am well</a></p>
<p style="color:#666;font-size:13px">If you cannot use the button, open ${url} in your browser.</p>
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
