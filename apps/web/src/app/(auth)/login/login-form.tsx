"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useState } from "react";
import { Input, Label, ErrorAlert, PasswordInput } from "@keeplas/ui";
import { AuthHeroSection } from "../components/auth-hero-section";
import { SSOButtons } from "../components/sso-buttons";
import { AuthDivider } from "../components/auth-divider";
import { MobileBrand } from "../components/mobile-brand";

export function LoginForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
                Identification Required
              </span>
            </div>
            <h3 className="font-headline text-3xl font-bold text-primary tracking-tight mb-2">
              Welcome back, Curator
            </h3>
            <p className="text-on-surface-variant font-body">
              Access your encrypted archives by verifying your credentials.
            </p>
          </div>

          <ErrorAlert message={error} />

          {/* Form */}
          <form onSubmit={handlePasswordSignIn} className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="curator@keeplas.vault"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-end ml-1">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full vault-gradient text-on-primary font-headline font-bold py-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
            >
              {loading ? "Unlocking..." : "Unlock Vault"}
            </button>
          </form>

          <AuthDivider />

          <SSOButtons
            redirectTo="/dashboard"
            disabled={loading}
            onError={setError}
            setLoading={setLoading}
          />

          {/* Footer */}
          <p className="mt-12 text-center text-sm font-body text-on-surface-variant">
            New Curator?{" "}
            <Link
              href="/signup"
              className="text-secondary font-bold hover:underline decoration-secondary decoration-2 underline-offset-4"
            >
              Request Access
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
