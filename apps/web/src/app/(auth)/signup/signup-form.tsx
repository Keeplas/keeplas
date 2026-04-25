"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Input, Label, PasswordInput } from "@keeplas/ui";
import { AuthFormShell } from "../components/auth-form-shell";
import { AuthSubmitButton } from "../components/auth-submit-button";

type Step = "details" | "verify";

export function SignupForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn("password", { name, email, password, flow: "signUp" });
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
      await signIn("password", {
        email,
        code,
        flow: "email-verification",
      });
    } catch {
      setError("Invalid or expired code.");
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email, flow: "email-verification" });
    } catch {
      setError("Could not resend the code. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthFormShell
        badgeLabel="Email Confirmation"
        heading="Confirm your email"
        description={`We sent a 6-digit code to ${email}. Enter it below to activate your vault.`}
        ssoRedirectTo="/onboarding"
        footer={{
          prompt: "Wrong email?",
          label: "Start over",
          href: "/signup",
          accent: "secondary",
        }}
        loading={loading}
        error={error}
        onError={setError}
        onLoadingChange={setLoading}
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
            {loading ? "Verifying..." : "Confirm Email"}
          </AuthSubmitButton>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading}
            className="w-full text-center text-label-md text-secondary font-bold hover:underline disabled:opacity-60"
          >
            Resend code
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
      ssoRedirectTo="/onboarding"
      footer={{
        prompt: "Already an owner?",
        label: "Access Vault",
        href: "/login",
        accent: "primary",
      }}
      loading={loading}
      error={error}
      onError={setError}
      onLoadingChange={setLoading}
      sideDecoration={<LegacyCardPreview />}
    >
      <form onSubmit={handlePasswordSignUp} className="space-y-6">
        <div className="grid grid-cols-1 gap-5">
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

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email Address</Label>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="curator@keeplas.vault"
              required
            />
          </div>

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
    <div className="absolute bottom-12 right-12 hidden lg:block rotate-3">
      <div className="bg-primary-container text-on-primary-container p-6 rounded-2xl w-64 shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <svg
            className="w-6 h-6 text-secondary-fixed opacity-60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
            />
          </svg>
          <span className="font-label text-[10px] tracking-widest uppercase opacity-40">
            Artifact #812
          </span>
        </div>
        <div>
          <p className="font-headline font-bold text-surface-container-lowest leading-tight">
            Property Deed: <br />
            Lake Como Villa
          </p>
          <p className="text-xs opacity-50 mt-1">Stored June 2024</p>
        </div>
        <div className="h-1 w-full bg-surface-container-highest/20 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-secondary-fixed" />
        </div>
      </div>
    </div>
  );
}
