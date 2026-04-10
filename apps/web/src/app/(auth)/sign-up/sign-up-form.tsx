"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignUp() {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", { redirectTo: "/dashboard" });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
      }
    } catch {
      setError("Failed to sign up with Google. Please try again.");
      setLoading(false);
    }
  }

  async function handlePasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
      {/* Left Side: Brand/Hero — Asymmetric Editorial */}
      <section className="hidden md:flex w-1/2 vault-gradient relative overflow-hidden flex-col justify-between p-16">
        {/* Decorative grain texture */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#ffffff 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/assets/logo/logo.svg"
              alt="Keeplas"
              width={36}
              height={36}
            />
            <h1 className="font-headline text-surface-container-lowest text-4xl font-extrabold tracking-tighter">
              Keeplas
            </h1>
          </div>
          <div className="h-1 w-12 bg-secondary mb-12" />
        </div>

        {/* Center: Hero text */}
        <div className="relative z-10 max-w-lg">
          <span className="font-headline uppercase tracking-[0.2em] text-secondary-fixed text-sm mb-6 block">
            The Digital Curator
          </span>
          <h2 className="font-headline text-surface-container-lowest text-6xl font-bold leading-[1.1] mb-8 tracking-tight">
            Secure Your <br />
            Digital Legacy.
          </h2>
          <p className="text-on-primary-container text-xl leading-relaxed font-light">
            A private gallery for your most vital assets. Protected by
            architectural-grade encryption, curated for your next generation.
          </p>
        </div>

        {/* Bottom: Stats */}
        <div className="relative z-10 flex gap-12 items-center">
          <div className="flex flex-col">
            <span className="font-headline font-bold text-surface-container-lowest text-2xl tracking-tighter">
              AES-256
            </span>
            <span className="font-label text-xs uppercase tracking-widest text-on-primary-container">
              Encryption Standard
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-surface-container-lowest text-2xl tracking-tighter">
              Zero-Knowledge
            </span>
            <span className="font-label text-xs uppercase tracking-widest text-on-primary-container">
              Architecture
            </span>
          </div>
        </div>

        {/* Background blur */}
        <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] opacity-10 blur-3xl rounded-full bg-secondary-fixed pointer-events-none" />
      </section>

      {/* Right Side: Signup Form */}
      <section className="flex-1 flex items-center justify-center p-8 md:p-24 relative bg-surface">
        {/* Mobile Brand */}
        <div className="absolute top-8 left-8 md:hidden flex items-center gap-2">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={28}
            height={28}
          />
          <h1 className="font-headline text-primary text-2xl font-black tracking-tighter">
            Keeplas
          </h1>
        </div>

        <div className="w-full max-w-md">
          {/* Header & Badge */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full mb-6">
              <svg
                className="w-4 h-4 text-secondary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span className="font-label text-[10px] uppercase tracking-widest font-bold text-on-secondary-container">
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

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handlePasswordSignUp} className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              {/* Full Name */}
              <div className="space-y-2">
                <label
                  className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1"
                  htmlFor="name"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Julian Voss"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label
                  className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1"
                  htmlFor="signup-email"
                >
                  Email Address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="curator@keeplas.vault"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all"
                />
              </div>

              {/* Password + Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1"
                    htmlFor="signup-password"
                  >
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1"
                    htmlFor="confirm"
                  >
                    Confirm
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all"
                  />
                </div>
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

          {/* Divider */}
          <div className="flex items-center my-10 gap-4">
            <div className="h-[1px] flex-1 bg-surface-container-high" />
            <span className="font-label text-[10px] uppercase tracking-widest text-outline-variant">
              Authorized via
            </span>
            <div className="h-[1px] flex-1 bg-surface-container-high" />
          </div>

          {/* SSO */}
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-3 rounded-xl transition-colors ghost-border disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-label text-xs font-bold text-on-surface">
                Google
              </span>
            </button>
          </div>

          {/* Footer */}
          <p className="mt-12 text-center text-sm font-body text-on-surface-variant">
            Already an owner?{" "}
            <Link
              href="/sign-in"
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
