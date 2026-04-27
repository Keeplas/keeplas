"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Input, Label, PasswordInput } from "@keeplas/ui";
import { AuthFormShell } from "../components/auth-form-shell";
import { AuthSubmitButton } from "../components/auth-submit-button";
import {
  getPasskeyErrorMessage,
  loginWithPasskey,
  usePasskeySupport,
} from "@/lib/passkey";

export function LoginForm() {
  const { signIn } = useAuthActions();
  const startPasskeyAuth = useMutation(api.webauthn.startAuthentication);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passkeySupported = usePasskeySupport();

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
        email || undefined
      );
    } catch (err) {
      setError(
        getPasskeyErrorMessage(err, "Could not authenticate with your passkey.")
      );
      setLoading(false);
    }
  }

  return (
    <AuthFormShell
      badgeLabel="Identification Required"
      heading="Welcome back, Curator"
      description="Access your encrypted archives by verifying your credentials."
      footer={{
        prompt: "New Curator?",
        label: "Request Access",
        href: "/signup",
        accent: "secondary",
      }}
      error={error}
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
              <Link
                href="/login/recovery"
                className="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline"
              >
                Reset with 24 words
              </Link>
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

      {passkeySupported && (
        <button
          type="button"
          onClick={handlePasskeySignIn}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-4 rounded-xl ghost-border transition-colors disabled:opacity-60"
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
            Biometric Authorization
          </span>
        </button>
      )}
    </AuthFormShell>
  );
}
