"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useState } from "react";
import { Input, Label, ErrorAlert, PasswordInput } from "@keeplas/ui";
import { AuthHeroSection } from "../components/auth-hero-section";
import { SSOButtons } from "../components/sso-buttons";
import { AuthDivider } from "../components/auth-divider";
import { MobileBrand } from "../components/mobile-brand";

export function SignupForm() {
  const { signIn } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch {
      setError("Could not create account. Email may already be in use.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row">
      <AuthHeroSection />

      <section className="flex-1 flex items-center justify-center p-8 md:p-24 relative bg-surface">
        <MobileBrand />

        <div className="w-full max-w-md">
          {/* Header & Badge */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full mb-6 shadow-sm">
              <svg
                className="w-5 h-5 text-secondary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
              <span className="font-label text-[11px] uppercase tracking-widest font-bold text-primary">
                Zero-Knowledge Encryption
              </span>
            </div>
            <h3 className="font-headline text-3xl font-bold text-primary tracking-tight mb-2">
              Create your sanctuary
            </h3>
            <p className="text-on-surface-variant font-body">
              Enter your details to begin your digital legacy.
            </p>
          </div>

          <ErrorAlert message={error} />

          {/* Form */}
          <form onSubmit={handlePasswordSignUp} className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              {/* Full Name */}
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

              {/* Email */}
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

              {/* Password */}
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

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full vault-gradient text-on-primary font-headline font-bold py-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
            >
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
            </button>
          </form>

          <AuthDivider />

          <SSOButtons
            redirectTo="/onboarding"
            disabled={loading}
            onError={setError}
            setLoading={setLoading}
          />

          {/* Footer */}
          <p className="mt-12 text-center text-sm font-body text-on-surface-variant">
            Already an owner?{" "}
            <Link
              href="/login"
              className="text-primary font-bold hover:underline decoration-secondary decoration-2 underline-offset-4"
            >
              Access Vault
            </Link>
          </p>
        </div>

        {/* Decorative: Legacy Card Preview (desktop only) */}
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
      </section>
    </main>
  );
}
