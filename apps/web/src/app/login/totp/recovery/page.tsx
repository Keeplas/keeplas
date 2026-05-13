"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { phraseToTotpResetVerifier } from "@keeplas/crypto";
import { Button, Icon, Label, Loader, Spinner, Textarea } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function TotpRecoveryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const gate = useQuery(api.totp.getMyTotpGate, isAuthenticated ? {} : "skip");
  const submitRecovery = useMutation(api.totp.submitTotpRecovery);

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
    return <Loader fullscreen label="Verifying session" />;
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
            Recovery not configured
          </h1>
          <p className="text-body-md text-on-surface-variant">
            This account never bound the recovery phrase to its authenticator.
            Contact support if you cannot access your authenticator app.
          </p>
          <Link
            href="/login/totp"
            className="text-body-md text-secondary hover:underline"
          >
            Back to code entry
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
      setError("Please enter all 24 words of your recovery phrase.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const verifierHash = await phraseToTotpResetVerifier(words);
      await submitRecovery({ verifierHash });
      router.push("/hub");
    } catch (err) {
      setError(getErrorMessage(err, "Recovery failed."));
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
          <h1 className="text-headline-md text-primary">
            Use your recovery phrase
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Paste the 24 words you saved during onboarding. Two-factor
            authentication will be disabled and you can set it up again from
            settings.
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
            <Label htmlFor="recovery-phrase">Recovery phrase</Label>
            <Textarea
              id="recovery-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="word1 word2 word3 ..."
              rows={4}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <p className="text-label-md text-on-surface-variant">
              Paste all 24 words. Case, spacing, numbers and punctuation are
              ignored — you can paste directly from the PDF.
            </p>
            <p className="text-label-md text-on-surface-variant">
              The phrase never leaves your device — only a derived verifier is
              sent.
            </p>
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={busy || phrase.trim().length === 0}
            className="w-full justify-center"
          >
            {busy ? <Spinner size="sm" /> : "Reset two-factor"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login/totp"
            className="text-body-md text-secondary hover:underline"
          >
            Back to code entry
          </Link>
        </div>
      </div>
    </main>
  );
}
