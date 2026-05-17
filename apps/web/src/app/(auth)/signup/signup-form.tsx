"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
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
import { useResendCooldown } from "@/lib/use-resend-cooldown";

type Step = "details" | "verify";

const INVITE_PATH_RE = /^\/invite\/([^/?#]+)/;

export function SignupForm() {
  const { signIn } = useAuthActions();
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
  const suggestedName =
    invitation && invitation.invitationStatus === "pending"
      ? invitation.name
      : undefined;

  const [step, setStep] = useState<Step>("details");
  // Invitations are email-based, so the phone option is hidden for them.
  const [kind, setKind] = useState<"email" | "phone">("phone");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cooldown = useResendCooldown(30);

  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  useEffect(() => {
    if (suggestedName && !name) setName(suggestedName);
  }, [suggestedName, name]);

  async function handlePasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "phone") {
      // Passwordless: request a WhatsApp OTP, then verify it in step 2.
      if (!phone || !isValidPhone(phone)) {
        setError("Please enter a valid phone number.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await requestPhoneOtp({ phoneNumber: phone, intent: "signup" });
        cooldown.start();
        setStep("verify");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not start signup. Try again.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn("password", {
        name,
        email,
        password,
        ...(phone ? { phoneNumber: phone } : {}),
        flow: "signUp",
      });
      cooldown.start();
      setStep("verify");
    } catch {
      setError("Could not create account. Email may already be in use.");
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
          flow: "signUp",
        });
      } else {
        await signIn("password", {
          email,
          code,
          flow: "email-verification",
        });
        // Signup already proved channel ownership — credit the fresh session
        // so the always-on login-OTP gate doesn't re-prompt.
        await creditSignupSession({}).catch(() => undefined);
      }
    } catch {
      setError("Invalid or expired code.");
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
        });
      } else {
        await signIn("password", { email, flow: "email-verification" });
      }
      cooldown.start();
    } catch {
      setError("Could not resend the code. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthFormShell
        badgeLabel={
          kind === "phone" ? "WhatsApp Confirmation" : "Email Confirmation"
        }
        heading={
          kind === "phone" ? "Confirm your number" : "Confirm your email"
        }
        description={
          kind === "phone"
            ? "We sent a 6-digit code to your WhatsApp. Enter it below to activate your vault."
            : `We sent a 6-digit code to ${email}. Enter it below to activate your vault.`
        }
        footer={{
          prompt: kind === "phone" ? "Wrong number?" : "Wrong email?",
          label: "Start over",
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
            <Label htmlFor="signup-code">Verification Code</Label>
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
              ? "Verifying..."
              : kind === "phone"
                ? "Confirm Number"
                : "Confirm Email"}
          </AuthSubmitButton>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading || cooldown.active}
            className="w-full text-center text-label-md text-secondary font-bold hover:underline disabled:opacity-60"
          >
            {cooldown.active
              ? `Resend code in ${cooldown.remaining}s`
              : "Resend code"}
          </button>
        </form>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      badgeLabel="Zero-Knowledge Encryption"
      heading="Create your sanctuary"
      description="Enter your details to begin your digital legacy."
      footer={{
        prompt: "Already an owner?",
        label: "Access Vault",
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
          Before you sign up · Quantum-safe end-to-end
        </p>
        <p className="text-body-sm text-on-surface leading-snug">
          Your password lets you sign in. The <strong>24 recovery words</strong>{" "}
          generated in the next step are what actually encrypt your vault, we
          never see them.
        </p>
        <span className="inline-flex items-center gap-1 mt-1.5 text-label-md text-secondary font-bold group-hover:underline">
          Read how it works →
        </span>
      </Link>

      <form onSubmit={handlePasswordSignUp} className="space-y-5">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Julian Voss"
              required
            />
          </div>

          {!lockedEmail && (
            <Tabs
              value={kind}
              onValueChange={(v) => setKind(v as "email" | "phone")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="phone" className="flex-1">
                  Phone
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1">
                  Email
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {kind === "email" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email Address</Label>
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
                    Locked — this is the email your inviter used to send you the
                    invitation.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone (optional)</Label>
                <PhoneInput
                  id="signup-phone"
                  value={phone}
                  onChange={setPhone}
                />
                <p className="text-label-md text-on-surface-variant">
                  Used for WhatsApp verification and Life Check alerts. You can
                  also reply to a Life Check on WhatsApp to confirm you are
                  well.{" "}
                  <Link
                    href="/security"
                    className="text-secondary font-bold hover:underline"
                  >
                    Learn more
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone Number</Label>
              <PhoneInput id="signup-phone" value={phone} onChange={setPhone} />
              <p className="text-label-md text-on-surface-variant">
                We&apos;ll send your verification code and Life Check alerts to
                this WhatsApp number.{" "}
                <Link
                  href="/security"
                  className="text-secondary font-bold hover:underline"
                >
                  Learn more
                </Link>
              </p>
            </div>
          )}

          {kind === "email" && (
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
          )}
        </div>

        <AuthSubmitButton disabled={loading}>
          {loading ? (
            "Initializing..."
          ) : (
            <>
              Initialize Vault
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
