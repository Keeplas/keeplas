"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useConvex } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { derivePhraseVerifier, validatePhrase } from "@keeplas/crypto";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
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
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function PasswordRecoveryPage() {
  const router = useRouter();
  const convex = useConvex();
  const resetPassword = useAction(api.passwordReset.resetPasswordWithRecovery);
  const getPhraseSaltByEmail = useAuditedMutation(
    api.passwordReset.getPhraseSaltByEmail,
  );
  const getPhraseSaltByPhone = useAuditedMutation(
    api.phone_auth.getPhraseSaltByPhone,
  );
  const { signIn } = useAuthActions();
  const t = useTranslations("auth.recovery");
  const c = useTranslations("common");

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

  // Fetch the account's per-user salt then derive the salted recovery-phrase
  // verifier client-side. The phrase never leaves the device — only the
  // Argon2id digest is sent. Throws when no recovery is configured.
  async function deriveVerifier(
    words: string[],
    account: { email: string } | { phoneNumber: string },
  ): Promise<string> {
    const saltResult =
      "email" in account
        ? await getPhraseSaltByEmail({ email: account.email })
        : await getPhraseSaltByPhone({ phoneNumber: account.phoneNumber });
    if (!saltResult?.phraseSalt) {
      throw new Error(t("notConfigured"));
    }
    return derivePhraseVerifier(words, base64ToUint8(saltResult.phraseSalt));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setError(t("allWords"));
      return;
    }
    // Fail fast on a malformed mnemonic (typo / transposed word) before any
    // network round-trip — the server verifier would only reject it later.
    if (!(await validatePhrase(words))) {
      setError(t("invalidPhrase"));
      return;
    }

    if (kind === "phone") {
      // Passwordless phone: 24 words → session via the phone-recovery
      // provider. No password to set.
      if (!phone || !isValidPhone(phone)) {
        setError(t("validPhone"));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const phraseHash = await deriveVerifier(words, { phoneNumber: phone });
        await signIn("phone-recovery", { phoneNumber: phone, phraseHash });
        router.push("/hub");
      } catch (err) {
        setError(getErrorMessage(err, t("phoneFailed")));
        setBusy(false);
      }
      return;
    }

    if (!email.trim()) {
      setError(t("enterEmail"));
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
        const phraseHash = await deriveVerifier(words, { email: email.trim() });
        await signIn("email-recovery", { email: email.trim(), phraseHash });
        router.push("/hub");
      } catch (err) {
        setError(getErrorMessage(err, t("emailFailed")));
        setBusy(false);
      }
      return;
    }

    if (newPassword.length < 8) {
      setError(t("passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const phraseHash = await deriveVerifier(words, { email: email.trim() });
      await resetPassword({
        email: email.trim(),
        phraseHash,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t("emailFailed")));
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
          <h1 className="text-headline-md text-primary">{t("successTitle")}</h1>
          <p className="text-body-md text-on-surface-variant">
            {t("successBody")}
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
          <h1 className="text-headline-md text-primary">{t("heading")}</h1>
          <p className="text-body-md text-on-surface-variant">
            {t("subtitle")}
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
                {c("email")}
              </TabsTrigger>
              <TabsTrigger value="phone" className="flex-1">
                {c("phone")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {kind === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="rec-email">{c("email")}</Label>
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
              <Label htmlFor="rec-phone">{c("phone")}</Label>
              <PhoneInput id="rec-phone" value={phone} onChange={setPhone} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rec-phrase">{t("phraseLabel")}</Label>
            <Textarea
              id="rec-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={t("phrasePlaceholder")}
              rows={4}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-label-md text-on-surface-variant">
              {t("phraseHint1")}
            </p>
            <p className="text-label-md text-on-surface-variant">
              {t("phraseHint2")}
            </p>
          </div>
          {kind === "email" && emailMode === "email-otp" && (
            <p className="text-label-md text-on-surface-variant">
              {t("emailOtpHint")}
            </p>
          )}
          {kind === "email" && emailMode !== "email-otp" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rec-new-password">{t("newPassword")}</Label>
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
                  {t("confirmPassword")}
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
              t("recoverAccess")
            ) : (
              t("resetPassword")
            )}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="text-body-md text-secondary hover:underline"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </main>
  );
}
