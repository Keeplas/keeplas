"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
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
        footer={{
          prompt: "Wrong email?",
          label: "Start over",
          href: "/signup",
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
      footer={{
        prompt: "Already an owner?",
        label: "Access Vault",
        href: "/login",
        accent: "primary",
      }}
      error={error}
      sideDecoration={<LegacyCardPreview />}
    >
      <Link
        href="/security"
        className="block mb-6 p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors group"
      >
        <p className="text-label-md text-secondary uppercase tracking-widest mb-2">
          Before you sign up · Quantum-safe end-to-end
        </p>
        <p className="text-body-md text-on-surface leading-relaxed">
          Your password is just authentication. Your <strong>24 recovery words</strong>{" "}
          encrypt your data — we never see them. Per-recipient keys are
          wrapped with <strong>ML-KEM-768</strong> (NIST post-quantum standard),
          so a future quantum computer can&apos;t retroactively break what we hold.
        </p>
        <span className="inline-flex items-center gap-1 mt-2 text-label-md text-secondary font-bold group-hover:underline">
          Read how it works →
        </span>
      </Link>

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
            <p className="text-label-md text-on-surface-variant">
              Your password authenticates you. The next step generates 24
              recovery words that encrypt your data — that&apos;s the real key.
            </p>
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
    <div className="absolute bottom-12 right-12 hidden lg:block">
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
