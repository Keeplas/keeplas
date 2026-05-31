"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { derivePhraseVerifier, validatePhrase } from "@keeplas/crypto";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
import { Button, Icon, Label, Loader, Spinner, Textarea } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function LoginOtpRecoveryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations("auth.phraseRecovery");
  const gate = useQuery(
    api.login_otp.getMyLoginOtpGate,
    isAuthenticated ? {} : "skip",
  );
  const submitRecovery = useMutation(api.login_otp.submitLoginOtpRecovery);

  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (gate && !gate.required && gate.authenticated) {
      router.push("/hub");
    }
  }, [gate, router]);

  if (isLoading || gate === undefined) {
    return <Loader fullscreen label={t("verifyingSession")} />;
  }
  if (!isAuthenticated || !gate.authenticated) return null;
  if (!gate.required) return null;
  if (!gate.recoveryBound) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-md text-center space-y-4">
          <Icon
            path={ICON_PATHS.warning}
            className="w-10 h-10 mx-auto text-error"
          />
          <h1 className="text-headline-md text-primary">
            {t("notConfiguredTitle")}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {t("otp.notConfiguredBody")}
          </p>
          <Link
            href="/login/otp"
            className="text-body-md text-secondary hover:underline"
          >
            {t("backToCode")}
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setError(t("allWords"));
      return;
    }
    if (!(await validatePhrase(words))) {
      setError(t("invalidPhrase"));
      return;
    }
    if (!gate?.phraseSalt) {
      setError(t("notConfigured"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const verifierHash = await derivePhraseVerifier(
        words,
        base64ToUint8(gate.phraseSalt),
      );
      await submitRecovery({ verifierHash });
      router.push("/hub");
    } catch (err) {
      setError(getErrorMessage(err, t("recoveryFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-secondary/15 items-center justify-center text-secondary">
            <Icon path={ICON_PATHS.key} className="w-7 h-7" />
          </div>
          <h1 className="text-headline-md text-primary">{t("useHeading")}</h1>
          <p className="text-body-md text-on-surface-variant">
            {t("otp.subtitle")}
          </p>
        </div>

        {error && (
          <div className="bg-error-container/40 p-3 rounded-xl">
            <p className="text-body-md text-on-error-container">{error}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest p-6 rounded-2xl space-y-4 ghost-border"
        >
          <div className="space-y-1.5">
            <Label htmlFor="recovery-phrase">{t("phraseLabel")}</Label>
            <Textarea
              id="recovery-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={t("phrasePlaceholder")}
              rows={4}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <p className="text-label-md text-on-surface-variant">
              {t("phraseHint1")}
            </p>
            <p className="text-label-md text-on-surface-variant">
              {t("phraseHint2")}
            </p>
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={busy || phrase.trim().length === 0}
            className="w-full justify-center"
          >
            {busy ? <Spinner size="sm" /> : t("otp.submit")}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login/otp"
            className="text-body-md text-secondary hover:underline"
          >
            {t("backToCode")}
          </Link>
        </div>
      </div>
    </main>
  );
}
