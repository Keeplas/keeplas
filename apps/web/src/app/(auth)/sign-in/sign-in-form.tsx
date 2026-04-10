"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", { redirectTo: "/dashboard" });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
      }
    } catch {
      setError("Failed to sign in with Google. Please try again.");
      setLoading(false);
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Left Side: Editorial Branding (Hidden on mobile) */}
      <section className="hidden md:flex md:w-1/2 relative vault-gradient items-center justify-center p-16 overflow-hidden">
        {/* Decorative grain texture */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#ffffff 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 max-w-lg">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <Image
                src="/assets/logo/logo.svg"
                alt="Keeplas"
                width={40}
                height={40}
              />
              <span className="font-headline text-2xl font-bold text-surface-container-lowest tracking-tighter">
                Keeplas
              </span>
            </div>
            <h1 className="font-headline text-6xl font-extrabold tracking-tighter text-surface-container-lowest leading-none">
              The Architectural <br /> Vault
            </h1>
          </div>
          <div className="space-y-6">
            <p className="font-headline text-xl text-secondary-fixed opacity-90 leading-relaxed font-light">
              A secure sanctuary for your digital legacies. Managed with the
              precision of a curator, protected by the strength of a fortress.
            </p>
            <div className="flex items-center gap-4 py-8">
              <div className="h-px w-12 bg-secondary-fixed/30" />
              <span className="font-label text-xs uppercase tracking-[0.3em] text-secondary-fixed/60">
                Digital Heritage Protocols
              </span>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="absolute bottom-12 left-12 flex items-center gap-2">
          <span className="font-label text-xs uppercase tracking-widest text-secondary-fixed">
            End-to-end encrypted. Open source.
          </span>
        </div>
      </section>

      {/* Right Side: Interaction Canvas */}
      <section className="flex-1 flex flex-col justify-center items-center p-6 md:p-24 relative bg-surface">
        {/* Mobile Brand Logo */}
        <div className="md:hidden absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={28}
            height={28}
          />
          <span className="font-headline text-2xl font-bold tracking-tighter text-primary">
            Keeplas
          </span>
        </div>

        <div className="w-full max-w-md space-y-12">
          {/* Header */}
          <header className="space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="w-7 h-7 text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a48.667 48.667 0 0 0-1.444 7.778M12 18.75a9 9 0 0 0 2.268-.235l.122-.029m-2.39.264-.088.014c-.74.123-1.498.185-2.262.185-1.753 0-3.45-.263-5.04-.757l-.106-.033M12 18.75c.69 0 1.366-.044 2.027-.127l.101-.013"
                />
              </svg>
              <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Identification Required
              </span>
            </div>
            <h2 className="font-headline text-4xl font-bold tracking-tight text-primary">
              Welcome back, Curator
            </h2>
            <p className="text-on-surface-variant font-body">
              Access your encrypted archives by verifying your credentials.
            </p>
          </header>

          {error && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handlePasswordSignIn} className="space-y-8">
            <div className="space-y-6">
              {/* Email */}
              <div className="group">
                <label
                  className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 ml-1"
                  htmlFor="email"
                >
                  Archive Identity (Email)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@vault.curator"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 px-6 focus:ring-0 focus:bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
                />
              </div>

              {/* Password */}
              <div className="group">
                <div className="flex justify-between items-end mb-2 ml-1">
                  <label
                    className="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant"
                    htmlFor="password"
                  >
                    Access Sequence (Password)
                  </label>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 px-6 focus:ring-0 focus:bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
                />
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full vault-gradient text-on-primary py-5 rounded-xl font-headline font-bold text-lg shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-60"
              >
                {loading ? "Unlocking..." : "Unlock Vault"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-surface-container-high" />
            <span className="font-label text-[10px] uppercase tracking-widest text-outline-variant">
              Authorized via
            </span>
            <div className="h-[1px] flex-1 bg-surface-container-high" />
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-4 rounded-xl transition-colors ghost-border disabled:opacity-60"
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

          {/* Footer */}
          <footer className="pt-4 flex flex-col items-center gap-8">
            <p className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant">
              New Curator?{" "}
              <Link
                href="/sign-up"
                className="text-secondary font-bold ml-1 hover:underline"
              >
                Request Access
              </Link>
            </p>

            {/* Security badge */}
            <div className="flex items-center gap-4 bg-secondary-container/20 px-6 py-3 rounded-full">
              <div className="flex -space-x-1">
                <svg
                  className="w-4 h-4 text-secondary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </svg>
                <svg
                  className="w-4 h-4 text-secondary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                Vault Encrypted &amp; Secured
              </span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
