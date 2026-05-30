"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { useConvex, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Input,
  Label,
  PasswordInput,
  PhoneInput,
  Tabs,
  TabsList,
  TabsTrigger,
  isValidPhone,
} from "@keeplas/ui";
import { AuthFormShell } from "../components/auth-form-shell";
import { AuthSubmitButton } from "../components/auth-submit-button";
import {
  getPasskeyErrorMessage,
  loginWithPasskey,
  usePasskeySupport,
} from "@/lib/passkey";
import { useResendCooldown } from "@/lib/use-resend-cooldown";
import { getErrorMessage } from "@/lib/utils";
import { userLanguageForLocale } from "@/lib/locale";
import { useLocale, useTranslations } from "@/lib/i18n";

export function LoginForm() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const startPasskeyAuth = useMutation(api.webauthn.startAuthentication);
  const requestPhoneOtp = useMutation(api.phone_auth.requestPhoneAuthOtp);
  const requestEmailOtp = useMutation(api.email_auth.requestEmailAuthOtp);
  const [kind, setKind] = useState<"email" | "phone">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const locale = useLocale();
  const language = userLanguageForLocale(locale);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  // How the entered email signs in: detected on blur/submit. "email-otp"
  // accounts (passwordless) get an emailed code instead of a password.
  const [emailMode, setEmailMode] = useState<
    "unknown" | "password" | "email-otp"
  >("unknown");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cooldown = useResendCooldown(30);
  const passkeySupported = usePasskeySupport();
  const t = useTranslations("auth.login");
  const c = useTranslations("common");

  function switchKind(next: "email" | "phone") {
    setKind(next);
    setError("");
    setPhoneCodeSent(false);
    setEmailCodeSent(false);
    setEmailMode("unknown");
    setCode("");
  }

  // Resolve whether the email is a password or passwordless (email-otp) account
  // so we can show the right field. Treats "no account" as password so the
  // existing invalid-credentials handling applies on submit.
  async function detectEmailMode(
    value: string,
  ): Promise<"password" | "email-otp"> {
    const mode = await convex
      .query(api.users.getEmailAuthMode, { email: value.trim() })
      .catch(() => null);
    const resolved = mode === "email-otp" ? "email-otp" : "password";
    setEmailMode(resolved);
    return resolved;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (kind === "email") {
      setLoading(true);
      setError("");
      let mode = emailMode;
      try {
        if (mode === "unknown") mode = await detectEmailMode(email);

        if (mode === "email-otp") {
          // Passwordless email: step 1 emails a code, step 2 signs in.
          if (!emailCodeSent) {
            await requestEmailOtp({
              email: email.trim(),
              intent: "signin",
              language,
            });
            setEmailCodeSent(true);
            cooldown.start();
            setLoading(false);
            return;
          }
          await signIn("email-otp", {
            email: email.trim(),
            code,
            language,
            flow: "signIn",
          });
          return;
        }

        await signIn("password", { email, password, flow: "signIn" });
      } catch (err) {
        if (mode === "email-otp") {
          setError(
            emailCodeSent
              ? c("invalidCode")
              : getErrorMessage(err, t("sendFailed")),
          );
        } else {
          // Tell apart "no account" (→ point to signup) from "wrong password".
          const exists = await convex
            .query(api.users.accountExistsByEmail, { email })
            .catch(() => true);
          setError(exists ? t("invalidCredentials") : t("noEmailAccount"));
        }
        setLoading(false);
      }
      return;
    }

    // Passwordless phone: step 1 requests a WhatsApp code, step 2 signs in.
    if (!phone || !isValidPhone(phone)) {
      setError(t("phoneInvalid"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!phoneCodeSent) {
        await requestPhoneOtp({
          phoneNumber: phone,
          intent: "signin",
          language,
        });
        setPhoneCodeSent(true);
        cooldown.start();
        setLoading(false);
        return;
      }
      await signIn("phone-otp", {
        phoneNumber: phone,
        code,
        language,
        flow: "signIn",
      });
    } catch (err) {
      setError(
        phoneCodeSent ? c("invalidCode") : getErrorMessage(err, t("sendFailed")),
      );
      setLoading(false);
    }
  }

  async function handleResendPhoneCode() {
    if (!phone || cooldown.active) return;
    setLoading(true);
    setError("");
    try {
      await requestPhoneOtp({ phoneNumber: phone, intent: "signin", language });
      cooldown.start();
    } catch {
      setError(t("resendFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendEmailCode() {
    if (!email.trim() || cooldown.active) return;
    setLoading(true);
    setError("");
    try {
      await requestEmailOtp({
        email: email.trim(),
        intent: "signin",
        language,
      });
      cooldown.start();
    } catch {
      setError(t("resendFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeySignIn() {
    setLoading(true);
    setError("");
    try {
      await loginWithPasskey(
        {
          startAuthentication: (args) => startPasskeyAuth(args),
          signInWithPasskey: (response) =>
            signIn("passkey", { response: response as never }),
        },
        email || undefined,
      );
    } catch (err) {
      setError(getPasskeyErrorMessage(err, t("passkeyFailed")));
      setLoading(false);
    }
  }

  const needsSendStep =
    (kind === "phone" && !phoneCodeSent) ||
    (kind === "email" && emailMode === "email-otp" && !emailCodeSent);
  const submitLabel = needsSendStep
    ? loading
      ? t("sending")
      : t("sendCode")
    : loading
      ? t("unlocking")
      : t("unlock");

  return (
    <AuthFormShell
      badgeLabel={t("badge")}
      heading={t("heading")}
      description={t("description")}
      footer={{
        prompt: t("footerPrompt"),
        label: t("footerLabel"),
        href: "/signup",
        accent: "secondary",
      }}
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-5">
          <Tabs
            value={kind}
            onValueChange={(v) => switchKind(v as "email" | "phone")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="phone" className="flex-1">
                {c("phone")}
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1">
                {c("email")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === "email" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">{c("emailAddress")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailMode("unknown");
                    setEmailCodeSent(false);
                  }}
                  onBlur={() => {
                    if (email.trim()) void detectEmailMode(email);
                  }}
                  placeholder="curator@keeplas.vault"
                />
              </div>

              {emailMode === "email-otp" ? (
                emailCodeSent ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-end ml-1">
                      <Label htmlFor="email-code">{t("emailCode")}</Label>
                      <Link
                        href="/login/recovery"
                        className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
                      >
                        {t("lostAccess")}
                      </Link>
                    </div>
                    <Input
                      id="email-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleResendEmailCode}
                      disabled={loading || cooldown.active}
                      className="text-label-md text-secondary font-bold hover:underline disabled:opacity-60"
                    >
                      {cooldown.active
                        ? c("resendIn", { seconds: cooldown.remaining })
                        : c("resendCode")}
                    </button>
                  </div>
                ) : (
                  <p className="text-label-md text-on-surface-variant ml-1">
                    {t("emailOtpHint")}
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-end ml-1">
                    <Label htmlFor="password">{c("password")}</Label>
                    <Link
                      href="/login/recovery"
                      className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
                    >
                      {t("resetWords")}
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required={emailMode === "password"}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="login-phone">{c("phoneNumber")}</Label>
                <PhoneInput
                  id="login-phone"
                  value={phone}
                  onChange={setPhone}
                />
              </div>

              {phoneCodeSent && (
                <div className="space-y-2">
                  <div className="flex justify-between items-end ml-1">
                    <Label htmlFor="login-code">{t("whatsappCode")}</Label>
                    <Link
                      href="/login/recovery"
                      className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
                    >
                      {t("lostPhone")}
                    </Link>
                  </div>
                  <Input
                    id="login-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleResendPhoneCode}
                    disabled={loading || cooldown.active}
                    className="text-label-md text-secondary font-bold hover:underline disabled:opacity-60"
                  >
                    {cooldown.active
                      ? c("resendIn", { seconds: cooldown.remaining })
                      : c("resendCode")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <AuthSubmitButton
          disabled={
            loading ||
            (kind === "phone" && phoneCodeSent && code.length !== 6) ||
            (kind === "email" &&
              emailMode === "email-otp" &&
              emailCodeSent &&
              code.length !== 6)
          }
        >
          {submitLabel}
        </AuthSubmitButton>
      </form>

      <p className="mt-4 text-center text-label-md text-on-surface-variant">
        <Link href="/security" className="hover:underline">
          {t("protectedLink")}
        </Link>
      </p>

      {passkeySupported && kind === "email" && (
        <button
          type="button"
          onClick={handlePasskeySignIn}
          disabled={loading}
          className="mt-3 w-full flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-3 rounded-xl ghost-border transition-colors disabled:opacity-60"
        >
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
            />
          </svg>
          <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">
            {t("passkey")}
          </span>
        </button>
      )}
    </AuthFormShell>
  );
}
