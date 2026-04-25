import { Email } from "@convex-dev/auth/providers/Email";

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
            : "&#39;"
  );
}

function otpEmailHtml(code: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;line-height:1.5;color:#1a1a1a;max-width:480px;margin:auto;padding:24px">
<p>Welcome to Keeplas. Use the code below to confirm your email address:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:0.4em;text-align:center;margin:32px 0;padding:16px;background:#f5f5f7;border-radius:12px">${escapeHtml(code)}</p>
<p style="color:#666;font-size:13px">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
</body></html>`;
}

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: OTP_TTL_SECONDS,
  async generateVerificationToken() {
    return generateNumericOtp(OTP_LENGTH);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

    const from =
      process.env.RESEND_FROM_EMAIL ?? "Keeplas <noreply@keeplas.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Confirm your Keeplas email",
        html: otpEmailHtml(token),
        text: `Your Keeplas confirmation code is ${token}. It expires in 15 minutes.`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
    }
  },
});
