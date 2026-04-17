"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Input, Label, PasswordInput } from "@keeplas/ui";
import { AuthFormShell } from "../components/auth-form-shell";
import { AuthSubmitButton } from "../components/auth-submit-button";

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
    <AuthFormShell
      badgeLabel="Identification Required"
      heading="Welcome back, Curator"
      description="Access your encrypted archives by verifying your credentials."
      ssoRedirectTo="/dashboard"
      footer={{
        prompt: "New Curator?",
        label: "Request Access",
        href: "/signup",
        accent: "secondary",
      }}
      loading={loading}
      error={error}
      onError={setError}
      onLoadingChange={setLoading}
    >
      <form onSubmit={handlePasswordSignIn} className="space-y-6">
        <div className="grid grid-cols-1 gap-5">
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

        <AuthSubmitButton disabled={loading}>
          {loading ? "Unlocking..." : "Unlock Vault"}
        </AuthSubmitButton>
      </form>
    </AuthFormShell>
  );
}
