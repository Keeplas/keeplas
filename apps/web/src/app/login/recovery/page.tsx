"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { phraseToHash } from "@keeplas/crypto";
import {
  Button,
  Icon,
  Input,
  Label,
  PasswordInput,
  Spinner,
  Textarea,
} from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function PasswordRecoveryPage() {
  const router = useRouter();
  const resetPassword = useAction(api.passwordReset.resetPasswordWithRecovery);

  const [email, setEmail] = useState("");
  const [phrase, setPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const words = phrase
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase());
    if (words.length !== 24) {
      setError("Please enter all 24 words of your recovery phrase.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const phraseHash = await phraseToHash(words);
      await resetPassword({
        email: email.trim().toLowerCase(),
        phraseHash,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Recovery failed. Check that your email and 24 words match."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-secondary/15 items-center justify-center text-secondary">
            <Icon path={ICON_PATHS.shieldCheck} className="w-7 h-7" />
          </div>
          <h1 className="text-headline-md text-primary">
            Password reset successful
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Your password was reset. You will be redirected to login. Your
            vault contents remain encrypted by your 24 words and stay safe.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-secondary/15 items-center justify-center text-secondary">
            <Icon path={ICON_PATHS.key} className="w-7 h-7" />
          </div>
          <h1 className="text-headline-md text-primary">
            Reset your password with your 24 words
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Your password is purely an authentication credential. Resetting it
            does not touch your encrypted vault — your 24 words remain the
            crypto root.
          </p>
        </div>

        {error ? (
          <div className="bg-error-container/40 p-3 rounded-xl">
            <p className="text-body-md text-on-error-container">{error}</p>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest p-6 rounded-2xl space-y-4 ghost-border"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rec-email">Email</Label>
            <Input
              id="rec-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-phrase">Recovery phrase (24 words)</Label>
            <Textarea
              id="rec-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="word1 word2 word3 ..."
              rows={4}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-label-md text-on-surface-variant">
              Words never leave this device — only a SHA-256 verifier is sent.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-new-password">New password</Label>
            <PasswordInput
              id="rec-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-confirm-password">Confirm new password</Label>
            <PasswordInput
              id="rec-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={busy || !email || !phrase || !newPassword}
            className="w-full justify-center"
          >
            {busy ? <Spinner size="sm" /> : "Reset password"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="text-body-md text-secondary hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
