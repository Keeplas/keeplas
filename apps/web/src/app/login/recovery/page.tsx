"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useConvex } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { phraseToHash } from "@keeplas/crypto";
import {
  Button,
  Icon,
  Input,
  Label,
  PasswordInput,
  PhoneInput,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  isValidPhone,
} from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function PasswordRecoveryPage() {
  const router = useRouter();
  const convex = useConvex();
  const resetPassword = useAction(api.passwordReset.resetPasswordWithRecovery);
  const { signIn } = useAuthActions();

  const [kind, setKind] = useState<"email" | "phone">("email");
  // Passwordless `email-otp` accounts recover with 24 words → session (no new
  // password); password accounts reset their password. Detected on blur/submit.
  const [emailMode, setEmailMode] = useState<
    "unknown" | "password" | "email-otp"
  >("unknown");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [phrase, setPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setError("Please enter all 24 words of your recovery phrase.");
      return;
    }

    if (kind === "phone") {
      // Passwordless phone: 24 words → session via the phone-recovery
      // provider. No password to set.
      if (!phone || !isValidPhone(phone)) {
        setError("Enter a valid phone number for your account.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const phraseHash = await phraseToHash(words);
        await signIn("phone-recovery", { phoneNumber: phone, phraseHash });
        router.push("/hub");
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Recovery failed. Check that your number and 24 words match.",
          ),
        );
        setBusy(false);
      }
      return;
    }

    if (!email.trim()) {
      setError("Enter the email for your account.");
      return;
    }

    let mode = emailMode;
    if (mode === "unknown") {
      const m = await convex
        .query(api.users.getEmailAuthMode, { email: email.trim() })
        .catch(() => null);
      mode = m === "email-otp" ? "email-otp" : "password";
      setEmailMode(mode);
    }

    if (mode === "email-otp") {
      // Passwordless email: 24 words → session via the email-recovery provider.
      setBusy(true);
      setError(null);
      try {
        const phraseHash = await phraseToHash(words);
        await signIn("email-recovery", { email: email.trim(), phraseHash });
        router.push("/hub");
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Recovery failed. Check that your email and 24 words match.",
          ),
        );
        setBusy(false);
      }
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
        email: email.trim(),
        phraseHash,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Recovery failed. Check that your email and 24 words match.",
        ),
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
            Your password was reset. You will be redirected to login. Your vault
            contents remain encrypted by your 24 words and stay safe.
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
            Recover access with your 24 words
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Email accounts reset their password; phone accounts regain access
            directly. Either way your encrypted vault is untouched — your 24
            words remain the crypto root.
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
          <Tabs
            value={kind}
            onValueChange={(v) => setKind(v as "email" | "phone")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="email" className="flex-1">
                Email
              </TabsTrigger>
              <TabsTrigger value="phone" className="flex-1">
                Phone
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {kind === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="rec-email">Email</Label>
              <Input
                id="rec-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailMode("unknown");
                }}
                onBlur={() => {
                  if (email.trim())
                    void convex
                      .query(api.users.getEmailAuthMode, {
                        email: email.trim(),
                      })
                      .then((m) =>
                        setEmailMode(
                          m === "email-otp" ? "email-otp" : "password",
                        ),
                      )
                      .catch(() => setEmailMode("password"));
                }}
                autoComplete="email"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="rec-phone">Phone</Label>
              <PhoneInput id="rec-phone" value={phone} onChange={setPhone} />
            </div>
          )}
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
              Paste all 24 words. Case, spacing, numbers and punctuation are
              ignored — you can paste directly from the PDF.
            </p>
            <p className="text-label-md text-on-surface-variant">
              Words never leave this device — only a SHA-256 verifier is sent.
            </p>
          </div>
          {kind === "email" && emailMode === "email-otp" && (
            <p className="text-label-md text-on-surface-variant">
              This account signs in with an emailed code — your 24 words restore
              access directly, no new password needed.
            </p>
          )}
          {kind === "email" && emailMode !== "email-otp" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rec-new-password">New password</Label>
                <PasswordInput
                  id="rec-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required={emailMode === "password"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-confirm-password">
                  Confirm new password
                </Label>
                <PasswordInput
                  id="rec-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required={emailMode === "password"}
                />
              </div>
            </>
          )}
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={
              busy ||
              (kind === "email"
                ? !email || (emailMode === "password" && !newPassword)
                : !phone) ||
              !phrase
            }
            className="w-full justify-center"
          >
            {busy ? (
              <Spinner size="sm" />
            ) : kind === "phone" || emailMode === "email-otp" ? (
              "Recover access"
            ) : (
              "Reset password"
            )}
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
