"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireEnv } from "./lib/require_env";
import { signLifeCheckToken } from "./lib/life_check_token";
import { type Locale, resolveLocale } from "./lib/locale";

const CHANNEL_TYPE = v.union(
  v.literal("push"),
  v.literal("email"),
  v.literal("whatsapp"),
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

  const locale = resolveLocale(user.language);
  const copy = LIFE_CHECK_PUSH_COPY[locale];
  const payload = JSON.stringify({
    title: copy.title,
    body: copy.body(user.name),
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

// How long the one-click confirm link stays valid after it's sent. Comfortably
// covers the 7-day check-in window (reminders keep issuing fresh tokens) while
// bounding how long a leaked link could reset a later cycle.
const CONFIRM_TOKEN_TTL_MS = 10 * 24 * 60 * 60 * 1000;

/**
 * Build the one-click confirmation URL. Always points at the Next.js app
 * (APP_URL) so user-facing emails never expose the raw Convex deployment
 * origin. The confirm page calls `life_check.confirmFromEmailToken`
 * server-side, which verifies the HMAC token without requiring a logged-in
 * session.
 */
async function buildConfirmUrl(
  cycleId: Id<"life_check_cycles">,
  userId: Id<"users">,
): Promise<string> {
  const base = requireEnv("APP_URL");
  const token = await signLifeCheckToken({
    cycleId,
    userId,
    exp: Date.now() + CONFIRM_TOKEN_TTL_MS,
  });
  return `${base}/life-check/confirm?token=${token}`;
}

async function sendEmail({ cycle, user }: DispatchContext): Promise<string> {
  if (!user.email) return "no_email";

  const verifyUrl = await buildConfirmUrl(cycle._id, user._id);
  const locale = resolveLocale(user.language);
  const copy = LIFE_CHECK_EMAIL_COPY[locale];

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[life_check_email] Resend not configured; confirm URL = ${verifyUrl}`,
    );
    return "resend_not_configured";
  }

  const from = requireEnv("RESEND_FROM_EMAIL");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: copy.subject,
      html: lifeCheckEmailHtml(user.name, verifyUrl, locale),
      text: copy.text(user.name, verifyUrl),
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
  // Dynamic URL-button suffix(es), in button order. Required when a template
  // has a "Click to URL" button with a trailing {{1}} placeholder (e.g. the
  // invitation token appended to https://app.keeplas.com/invite/).
  buttons?: { type: "URL" | "QUICK_REPLY"; parameter: string }[];
}): Promise<string> {
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const apiKey = process.env.INFOBIP_API_KEY;
  const sender = process.env.INFOBIP_WHATSAPP_SENDER;
  if (!baseUrl || !apiKey || !sender) return "whatsapp_not_configured";

  // Infobip's dashboard hands out the base URL as a bare host
  // (e.g. "d83lev.api.infobip.com"); fetch() requires an absolute URL, so
  // default to https:// when no scheme is present.
  const root = baseUrl.replace(/\/$/, "");
  const origin = /^https?:\/\//i.test(root) ? root : `https://${root}`;

  const res = await fetch(`${origin}/whatsapp/1/message/template`, {
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
              ...(args.buttons ? { buttons: args.buttons } : {}),
            },
            language: args.language,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`whatsapp ${res.status}: ${text.slice(0, 120)}`);
  }

  // HTTP 2xx only means Infobip accepted the request — the per-message status
  // tells us whether it was actually queued for delivery or rejected (wrong /
  // unapproved template, number not on WhatsApp, outside the 24h session
  // window, ...). Surface it so a rejected send isn't silently logged as "sent".
  const body = (await res.json().catch(() => null)) as {
    messages?: {
      status?: { groupName?: string; name?: string; description?: string };
    }[];
  } | null;
  const status = body?.messages?.[0]?.status;
  if (!status?.name) return "sent";
  const group = (status.groupName ?? "").toUpperCase();
  if (group === "REJECTED" || group === "UNDELIVERABLE") {
    return `rejected:${status.name}${status.description ? ` (${status.description})` : ""}`;
  }
  return status.name.toLowerCase();
}

async function sendWhatsApp({ user }: DispatchContext): Promise<string> {
  if (!user.phoneNumber) return "no_phone";
  const locale = resolveLocale(user.language);
  return sendWhatsAppTemplate({
    to: user.phoneNumber,
    templateName: localizedTemplateName(
      process.env.WHATSAPP_LIFE_CHECK_TEMPLATE_NAME,
      "keeplas_life_check",
      locale,
    ),
    language: locale,
    // The template carries a single "I'm well" QUICK_REPLY button; Infobip
    // rejects the send (error 7008, UNDELIVERABLE_REJECTED_OPERATOR) unless we
    // echo it back. The payload is irrelevant to us — any reply maps to the
    // user by phone in validateFromWhatsApp — but it must be present.
    buttons: [{ type: "QUICK_REPLY", parameter: "im_well" }],
  });
}

/**
 * Out-of-band delivery of a 6-digit OTP via WhatsApp (Infobip transport).
 * Uses an authentication-category template (configurable via
 * WHATSAPP_OTP_TEMPLATE_NAME). WhatsApp authentication templates require the
 * code in BOTH the body placeholder AND the copy-code button parameter —
 * omitting the button yields Infobip error 7008 ("Failed to match template
 * parameters"). Per Meta convention the copy-code button is sent as type
 * "URL". Falls back to a console log in dev when credentials are missing so
 * manual testing remains possible.
 */
export const sendWhatsAppOtp = internalAction({
  args: {
    phoneNumber: v.string(),
    code: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const locale = resolveLocale(args.language);
    const result = await sendWhatsAppTemplate({
      to: args.phoneNumber,
      templateName: localizedTemplateName(
        process.env.WHATSAPP_OTP_TEMPLATE_NAME,
        "keeplas_otp",
        locale,
      ),
      language: locale,
      placeholders: [args.code],
      buttons: [{ type: "URL", parameter: args.code }],
    });
    if (result === "whatsapp_not_configured") {
      console.warn(
        `[whatsapp_otp] credentials missing; OTP for ${args.phoneNumber} = ${args.code}`,
      );
    }
    return result;
  },
});

/**
 * WhatsApp invitation to a trusted contact (additive — email via Resend
 * stays the primary channel). Utility template `keeplas_invite_tc_en`:
 * body placeholder = inviter name; the "Click to URL" button appends the
 * invitation token to https://app.keeplas.com/invite/. No-op when the
 * Infobip credentials are missing.
 */
export const sendInvitationWhatsApp = internalAction({
  args: {
    phoneNumber: v.string(),
    inviterName: v.string(),
    invitationToken: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const locale = resolveLocale(args.language);
    return sendWhatsAppTemplate({
      to: args.phoneNumber,
      templateName: localizedTemplateName(
        process.env.WHATSAPP_TC_INVITE_TEMPLATE_NAME,
        "keeplas_invite_tc",
        locale,
      ),
      language: locale,
      placeholders: [args.inviterName],
      buttons: [{ type: "URL", parameter: args.invitationToken }],
    });
  },
});

/**
 * WhatsApp courtesy intro to a recipient-only contact who provided a phone
 * number. Utility template `keeplas_invite_recipient_only_en`: body
 * placeholder = inviter name; static "Discover Keeplas" URL button
 * (no parameter). No-op when Infobip is not configured.
 */
export const sendRecipientInvitationWhatsApp = internalAction({
  args: {
    phoneNumber: v.string(),
    inviterName: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const locale = resolveLocale(args.language);
    return sendWhatsAppTemplate({
      to: args.phoneNumber,
      templateName: localizedTemplateName(
        process.env.WHATSAPP_TC_RECIPIENT_INVITE_TEMPLATE_NAME,
        "keeplas_invite_recipient_only",
        locale,
      ),
      language: locale,
      placeholders: [args.inviterName],
    });
  },
});

/**
 * WhatsApp availability re-confirmation nudge to a trusted contact whose
 * shard verification is stale/missing. Utility template
 * `keeplas_tc_reconfirm_en` (`_fr` variant auto-selected by locale): body
 * placeholder = vault owner name; static URL button (no parameter). No-op when
 * Infobip is not configured.
 */
export const sendReconfirmWhatsApp = internalAction({
  args: {
    phoneNumber: v.string(),
    ownerName: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const locale = resolveLocale(args.language);
    return sendWhatsAppTemplate({
      to: args.phoneNumber,
      templateName: localizedTemplateName(
        process.env.WHATSAPP_TC_RECONFIRM_TEMPLATE_NAME,
        "keeplas_tc_reconfirm",
        locale,
      ),
      language: locale,
      placeholders: [args.ownerName],
    });
  },
});

/**
 * Out-of-band delivery of a 6-digit login OTP via email (Resend). Sibling of
 * `sendWhatsAppOtp` for the email-keyed channel of the always-on login
 * step-up. No-ops with a console log in dev when Resend is unconfigured so
 * manual testing remains possible.
 */
export const sendEmailOtp = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        `[login_otp] Resend not configured; OTP for ${args.email} = ${args.code}`,
      );
      return "resend_not_configured";
    }
    const from = requireEnv("RESEND_FROM_EMAIL");
    const locale = resolveLocale(args.language);
    const copy = EMAIL_OTP_COPY[locale];
    const code = escapeHtml(args.code);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.email],
        subject: copy.subject,
        html: otpEmailHtml(code, locale),
        text: copy.text(args.code),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
    }
    return "sent";
  },
});

function localizedTemplateName(
  configuredName: string | undefined,
  baseName: string,
  locale: Locale,
): string {
  const fallback = `${baseName}_${locale}`;
  if (!configuredName) return fallback;
  if (locale === "en") return configuredName.replace(/_fr$/i, "_en");
  if (/_en$/i.test(configuredName))
    return configuredName.replace(/_en$/i, "_fr");
  if (/_fr$/i.test(configuredName)) return configuredName;
  return `${configuredName}_fr`;
}

const LIFE_CHECK_PUSH_COPY = {
  en: {
    title: "Keeplas Life Check",
    body: (name: string | undefined) =>
      `${name ?? "Hi"}, please confirm you are well.`,
  },
  fr: {
    title: "Vérification Keeplas",
    body: (name: string | undefined) =>
      `${name ?? "Bonjour"}, confirmez que vous allez bien.`,
  },
} satisfies Record<Locale, { title: string; body: (name?: string) => string }>;

const EMAIL_OTP_COPY = {
  en: {
    subject: "Your Keeplas login code",
    intro: "Use this code to finish signing in to Keeplas:",
    expiry:
      "This code expires in 10 minutes. If you didn't try to sign in, change your password.",
    text: (code: string) =>
      `Your Keeplas login code is ${code}. It expires in 10 minutes.`,
  },
  fr: {
    subject: "Votre code de connexion Keeplas",
    intro: "Utilisez ce code pour terminer votre connexion à Keeplas :",
    expiry:
      "Ce code expire dans 10 minutes. Si vous n'avez pas tenté de vous connecter, changez votre mot de passe.",
    text: (code: string) =>
      `Votre code de connexion Keeplas est ${code}. Il expire dans 10 minutes.`,
  },
} satisfies Record<
  Locale,
  {
    subject: string;
    intro: string;
    expiry: string;
    text: (code: string) => string;
  }
>;

const LIFE_CHECK_EMAIL_COPY = {
  en: {
    subject: "Keeplas — your scheduled check-in",
    greeting: (name: string | undefined) => (name ? `Hi ${name},` : "Hi,"),
    body: "It's time for your scheduled Keeplas check-in. Tap the button below to confirm you're well and reset your countdown — no need to log in.",
    button: "I am well",
    fallback:
      "If you cannot use the button, open {{url}} in your browser. If you don't respond, Keeplas will keep reminding you, then begin your continuity protocol.",
    text: (name: string | undefined, url: string) =>
      `${name ? `Hi ${name},\n\n` : ""}It's time for your scheduled Keeplas check-in. Confirm you're well here: ${url}`,
  },
  fr: {
    subject: "Keeplas — votre vérification programmée",
    greeting: (name: string | undefined) =>
      name ? `Bonjour ${name},` : "Bonjour,",
    body: "C'est le moment de votre vérification programmée Keeplas. Appuyez sur le bouton ci-dessous pour confirmer que vous allez bien et réinitialiser le compte à rebours, sans vous connecter.",
    button: "Je vais bien",
    fallback:
      "Si le bouton ne fonctionne pas, ouvrez {{url}} dans votre navigateur. Sans réponse de votre part, Keeplas continuera les rappels, puis lancera votre protocole de continuité.",
    text: (name: string | undefined, url: string) =>
      `${name ? `Bonjour ${name},\n\n` : ""}C'est le moment de votre vérification programmée Keeplas. Confirmez que vous allez bien ici : ${url}`,
  },
} satisfies Record<
  Locale,
  {
    subject: string;
    greeting: (name?: string) => string;
    body: string;
    button: string;
    fallback: string;
    text: (name: string | undefined, url: string) => string;
  }
>;

function otpEmailHtml(code: string, locale: Locale) {
  const copy = EMAIL_OTP_COPY[locale];
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:480px;margin:auto;padding:24px"><p>${copy.intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:0.4em;text-align:center;margin:32px 0;padding:16px;background:#f5f5f7;border-radius:12px">${code}</p><p style="color:#666;font-size:13px">${copy.expiry}</p></body></html>`;
}

function lifeCheckEmailHtml(
  name: string | undefined,
  url: string,
  locale: Locale,
) {
  const copy = LIFE_CHECK_EMAIL_COPY[locale];
  const greeting = escapeHtml(copy.greeting(name));
  const fallback = copy.fallback.replace("{{url}}", url);
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:480px;margin:auto;padding:24px">
<p>${greeting}</p>
<p>${copy.body}</p>
<p style="margin:32px 0"><a href="${url}" style="display:inline-block;padding:12px 24px;background:#0b1f3b;color:#fff;text-decoration:none;border-radius:8px">${copy.button}</a></p>
<p style="color:#666;font-size:13px">${fallback}</p>
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
