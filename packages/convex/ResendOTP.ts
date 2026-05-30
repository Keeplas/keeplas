import { Email } from "@convex-dev/auth/providers/Email";
import { requireEnv } from "./lib/require_env";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { resolveLocale, type Locale } from "./lib/locale";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 60 * 15;

function generateNumericOtp(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += (byte % 10).toString();
  return out;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
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

const OTP_EMAIL_COPY = {
  en: {
    subject: "Confirm your Keeplas email",
    intro: "Welcome to Keeplas. Use the code below to confirm your email address:",
    expiry:
      "This code expires in 15 minutes. If you didn't request it, you can ignore this email.",
    text: (code: string) =>
      `Your Keeplas confirmation code is ${code}. It expires in 15 minutes.`,
  },
  fr: {
    subject: "Confirmez votre email Keeplas",
    intro:
      "Bienvenue sur Keeplas. Utilisez le code ci-dessous pour confirmer votre adresse email :",
    expiry:
      "Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    text: (code: string) =>
      `Votre code de confirmation Keeplas est ${code}. Il expire dans 15 minutes.`,
  },
} satisfies Record<
  Locale,
  { subject: string; intro: string; expiry: string; text: (code: string) => string }
>;

function otpEmailHtml(appUrl: string, code: string, locale: Locale) {
  const copy = OTP_EMAIL_COPY[locale];
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:480px;margin:auto;padding:24px">
<p style="text-align:center;margin:0 0 32px"><img src="${appUrl}/assets/logo/logo-wordmark.svg" alt="Keeplas" width="220" height="44" style="display:inline-block;border:0;outline:none;text-decoration:none"/></p>
<p>${copy.intro}</p>
<p style="font-size:28px;font-weight:700;letter-spacing:0.4em;text-align:center;margin:32px 0;padding:16px;background:#f5f5f7;border-radius:12px">${escapeHtml(code)}</p>
<p style="color:#666;font-size:13px">${copy.expiry}</p>
</body></html>`;
}

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: OTP_TTL_SECONDS,
  async generateVerificationToken() {
    return generateNumericOtp(OTP_LENGTH);
  },
  // convex-auth passes the action ctx as a 2nd arg at runtime, but the Auth.js
  // Email type only declares the first param — capture ctx via a rest param so
  // we keep contextual typing of `params` without an arity mismatch.
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ...rest: unknown[]
  ) {
    const ctx = rest[0] as ActionCtx;
    const apiKey = requireEnv("RESEND_API_KEY");
    const from = requireEnv("RESEND_FROM_EMAIL");
    const appUrl = requireEnv("APP_URL");

    // Send the confirmation in the recipient's chosen language. The account is
    // created (with its `language`) before this verification fires, so a lookup
    // by email resolves it; defaults to English when unknown.
    const language = await ctx
      .runQuery(internal.users.getLanguageByEmail, { email })
      .catch(() => undefined);
    const locale = resolveLocale(language);
    const copy = OTP_EMAIL_COPY[locale];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: copy.subject,
        html: otpEmailHtml(appUrl, token, locale),
        text: copy.text(token),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
    }
  },
});
