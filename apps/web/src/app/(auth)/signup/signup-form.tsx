"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Input,
  Label,
  PasswordInput,
  PasswordStrength,
  PhoneInput,
  Tabs,
  TabsList,
  TabsTrigger,
  evaluatePassword,
  isValidPhone,
} from "@keeplas/ui";
import { AuthFormShell } from "../components/auth-form-shell";
import { AuthSubmitButton } from "../components/auth-submit-button";
import { useResendCooldown } from "@/lib/use-resend-cooldown";
import { getErrorMessage } from "@/lib/utils";
import { userLanguageForLocale } from "@/lib/locale";
import { useLocale, useTranslations } from "@/lib/i18n";

type Step = "details" | "verify";

const INVITE_PATH_RE = /^\/invite\/([^/?#]+)/;

export function SignupForm() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const creditSignupSession = useMutation(api.login_otp.creditSignupSession);
  const requestPhoneOtp = useMutation(api.phone_auth.requestPhoneAuthOtp);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "";
  const inviteToken = redirect.match(INVITE_PATH_RE)?.[1];

  const invitation = useQuery(
    api.trusted_contacts.getInvitationByToken,
    inviteToken ? { token: inviteToken } : "skip",
  );
  const lockedEmail =
    invitation && invitation.invitationStatus === "pending"
      ? invitation.email
      : undefined;
  const lockedPhone =
    invitation && invitation.invitationStatus === "pending"
      ? (invitation.phoneNumber ?? undefined)
      : undefined;
  const suggestedName =
    invitation && invitation.invitationStatus === "pending"
      ? invitation.name
      : undefined;

  const [step, setStep] = useState<Step>("details");
  const [kind, setKind] = useState<"email" | "phone">("phone");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const locale = useLocale();
  const language = userLanguageForLocale(locale);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cooldown = useResendCooldown(30);
  const t = useTranslations("auth.signup");
  const c = useTranslations("common");
  const ps = useTranslations("common.passwordStrength");
  const passwordLabels = useMemo(
    () => ({
      weak: ps("weak"),
      medium: ps("medium"),
      strong: ps("strong"),
      rules: {
        length: ps("length"),
        uppercase: ps("uppercase"),
        lowercase: ps("lowercase"),
        number: ps("number"),
        special: ps("special"),
      },
    }),
    [ps],
  );

  // Email/phone tabs show when there's no invitation, or when the invitation
  // carries both identifiers; an email-only invitation hides them.
  const showIdentityTabs = !lockedEmail || !!lockedPhone;

  // Anchor the signup fields to the invitation once it resolves, without
  // clobbering anything the user has typed. Adjusting during render avoids
  // setState-in-effect syncs.
  const [seededInvite, setSeededInvite] = useState(invitation);
  if (invitation !== seededInvite) {
    setSeededInvite(invitation);
    if (lockedEmail) setEmail(lockedEmail);
    if (lockedPhone) setPhone(lockedPhone);
    if (suggestedName && !name) setName(suggestedName);
  }

  // Once the invitation resolves, anchor the signup to its identifiers: if it
  // carries a phone, default to the passwordless Phone tab; otherwise force the
  // Email tab so the locked email actually renders. Guarded so a manual tab
  // switch afterwards is never overridden.
  const inviteKindApplied = useRef(false);
  useEffect(() => {
    if (!lockedEmail || inviteKindApplied.current) return;
    inviteKindApplied.current = true;
    setKind(lockedPhone ? "phone" : "email");
  }, [lockedEmail, lockedPhone]);

  async function handlePasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "phone") {
      // Passwordless: request a WhatsApp OTP, then verify it in step 2.
      if (!phone || !isValidPhone(phone)) {
        setError(t("phoneInvalid"));
        return;
      }
      setLoading(true);
      setError("");
      try {
        await requestPhoneOtp({
          phoneNumber: phone,
          intent: "signup",
          language,
        });
        cooldown.start();
        setStep("verify");
      } catch (err) {
        setError(getErrorMessage(err, t("startFailed")));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!evaluatePassword(password).isStrong) {
      setError(t("passwordWeak"));
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError(t("phoneInvalid"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn("password", {
        name,
        email,
        password,
        language,
        ...(phone ? { phoneNumber: phone } : {}),
        flow: "signUp",
      });
      cooldown.start();
      setStep("verify");
    } catch {
      // Tell apart "already exists" (→ point to login) from other failures.
      // On any lookup failure, fall back to the generic create error.
      const exists = await convex
        .query(api.users.accountExistsByEmail, { email })
        .catch(() => false);
      setError(exists ? t("accountExists") : t("createFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (kind === "phone") {
        // Passwordless phone: the code IS the auth. No login-OTP gate to
        // credit (phone-otp accounts skip it).
        await signIn("phone-otp", {
          phoneNumber: phone as string,
          code,
          name,
          language,
          flow: "signUp",
        });
      } else {
        await signIn("password", {
          email,
          code,
          language,
          flow: "email-verification",
        });
        // Signup already proved channel ownership — credit the fresh session
        // so the always-on login-OTP gate doesn't re-prompt.
        await creditSignupSession({}).catch(() => undefined);
      }
    } catch {
      setError(c("invalidCode"));
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (cooldown.active) return;
    setLoading(true);
    setError("");
    try {
      if (kind === "phone") {
        await requestPhoneOtp({
          phoneNumber: phone as string,
          intent: "signup",
          language,
        });
      } else {
        await signIn("password", {
          email,
          language,
          flow: "email-verification",
        });
      }
      cooldown.start();
    } catch {
      setError(t("resendFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthFormShell
        badgeLabel={
          kind === "phone" ? t("whatsappConfirmation") : t("emailConfirmation")
        }
        heading={
          kind === "phone"
            ? t("confirmNumberHeading")
            : t("confirmEmailHeading")
        }
        description={
          kind === "phone"
            ? t("phoneCodeSent", { phone: phone ?? "" })
            : t("emailCodeSent", { email })
        }
        footer={{
          prompt: kind === "phone" ? t("wrongNumber") : t("wrongEmail"),
          label: t("startOver"),
          onClick: () => {
            setStep("details");
            setCode("");
            setError("");
          },
          accent: "secondary",
        }}
        error={error}
      >
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="signup-code">{t("verifyCode")}</Label>
            <Input
              id="signup-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
            />
          </div>

          <AuthSubmitButton disabled={loading || code.length !== 6}>
            {loading
              ? t("verifying")
              : kind === "phone"
                ? t("confirmNumber")
                : t("confirmEmail")}
          </AuthSubmitButton>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading || cooldown.active}
            className="w-full text-center text-label-md text-secondary font-bold hover:underline disabled:opacity-60"
          >
            {cooldown.active
              ? c("resendIn", { seconds: cooldown.remaining })
              : c("resendCode")}
          </button>
        </form>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      badgeLabel={t("badge")}
      heading={t("heading")}
      description={t("description")}
      footer={{
        prompt: t("footerPrompt"),
        label: t("footerLabel"),
        href: "/login",
        accent: "primary",
      }}
      error={error}
      heroDecoration={<LegacyCardPreview />}
    >
      <Link
        href="/security"
        className="block mb-5 p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors group"
      >
        <p className="text-label-md text-secondary uppercase tracking-widest mb-1.5">
          {t("securityEyebrow")}
        </p>
        <p className="text-body-sm text-on-surface leading-snug">
          {t("securityText")}
        </p>
        <span className="inline-flex items-center gap-1 mt-1.5 text-label-md text-secondary font-bold group-hover:underline">
          {t("readHow")}
        </span>
      </Link>

      <form onSubmit={handlePasswordSignUp} className="space-y-5">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Julian Voss"
              required
            />
          </div>

          {showIdentityTabs && (
            <Tabs
              value={kind}
              onValueChange={(v) => setKind(v as "email" | "phone")}
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
          )}

          {kind === "email" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="signup-email">{c("emailAddress")}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="curator@keeplas.vault"
                  disabled={!!lockedEmail}
                  readOnly={!!lockedEmail}
                  required
                />
                {lockedEmail && (
                  <p className="text-label-md text-on-surface-variant">
                    {t("lockedEmail")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-phone">
                  {lockedPhone ? c("phoneNumber") : t("phoneOptional")}
                </Label>
                <PhoneInput
                  id="signup-phone"
                  value={phone}
                  onChange={setPhone}
                  disabled={!!lockedPhone}
                />
                {lockedPhone ? (
                  <p className="text-label-md text-on-surface-variant">
                    {t("lockedPhone")}
                  </p>
                ) : (
                  <p className="text-label-md text-on-surface-variant">
                    {t("phoneHelp")}{" "}
                    <Link
                      href="/security"
                      className="text-secondary font-bold hover:underline"
                    >
                      {c("learnMore")}
                    </Link>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="signup-phone">{c("phoneNumber")}</Label>
              <PhoneInput
                id="signup-phone"
                value={phone}
                onChange={setPhone}
                disabled={!!lockedPhone}
              />
              {lockedPhone ? (
                <p className="text-label-md text-on-surface-variant">
                  {t("lockedPhone")}
                </p>
              ) : (
                <p className="text-label-md text-on-surface-variant">
                  {t("phoneOnlyHelp")}{" "}
                  <Link
                    href="/security"
                    className="text-secondary font-bold hover:underline"
                  >
                    {c("learnMore")}
                  </Link>
                </p>
              )}
            </div>
          )}

          {kind === "email" && (
            <div className="space-y-2">
              <Label htmlFor="signup-password">{c("password")}</Label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              {password.length > 0 && (
                <PasswordStrength
                  password={password}
                  labels={passwordLabels}
                  className="pt-1"
                />
              )}
            </div>
          )}
        </div>

        <AuthSubmitButton disabled={loading}>
          {loading ? (
            t("initializing")
          ) : (
            <>
              {t("initializeVault")}
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </>
          )}
        </AuthSubmitButton>
      </form>
    </AuthFormShell>
  );
}

function LegacyCardPreview() {
  return (
    <div className="pointer-events-none absolute right-8 bottom-44 hidden lg:block z-20">
      <div className="relative w-72">
        {/* Layered cards behind for depth */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl bg-primary-container/30 translate-x-3 translate-y-3 rotate-6"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl bg-primary-container/60 translate-x-1.5 translate-y-1.5 rotate-3 ring-1 ring-secondary-fixed/10"
        />

        {/* Front card */}
        <div className="relative bg-primary-container text-on-primary-container p-6 rounded-2xl shadow-2xl rotate-3 ring-1 ring-secondary-fixed/20 overflow-hidden">
          {/* Subtle radial highlight */}
          <div
            aria-hidden
            className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-secondary-fixed/10 blur-2xl pointer-events-none"
          />

          {/* Header */}
          <div className="relative flex justify-between items-start mb-5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-secondary-fixed/15 flex items-center justify-center text-secondary-fixed">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="font-label text-[10px] tracking-widest uppercase opacity-50">
                  Artifact · #812
                </span>
                <span className="inline-flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-secondary-fixed animate-ping opacity-70" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary-fixed" />
                  </span>
                  <span className="font-label text-[10px] tracking-widest uppercase text-secondary-fixed font-bold">
                    Sealed
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="relative mb-5">
            <p className="font-headline font-bold text-surface-container-lowest leading-tight text-base">
              Property Deed:
              <br />
              Lake Como Villa
            </p>
            <p className="text-[11px] opacity-55 mt-1.5">
              Stored June 2024 · 3 recipients
            </p>
          </div>

          {/* Encrypted blocks visualisation */}
          <div className="relative flex gap-1 mb-4" aria-hidden>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full bg-secondary-fixed/40"
                style={{
                  opacity: 0.25 + ((i * 17) % 75) / 100,
                }}
              />
            ))}
          </div>

          {/* Footer: PQ tag */}
          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary-fixed/15 text-secondary-fixed">
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
                />
              </svg>
              <span className="font-label text-[9px] tracking-widest uppercase font-bold">
                ML-KEM-768
              </span>
            </span>
            <span className="font-label text-[9px] tracking-widest uppercase opacity-40">
              Quantum-safe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
