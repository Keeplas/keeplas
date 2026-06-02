import { useEffect, useState } from "react";
import { Link } from "@/lib/navigation";
import { useRouter } from "@/lib/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button, Icon, Input, Label, Loader, Spinner } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export default function TotpLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const t = useTranslations("auth.totp");
  const gate = useQuery(api.totp.getMyTotpGate, isAuthenticated ? {} : "skip");
  const submit = useMutation(api.totp.submitTotpForSession);

  const [code, setCode] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ code: code.trim() });
      router.push("/hub");
    } catch (err) {
      setError(getErrorMessage(err, t("verifyFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-secondary/15 items-center justify-center text-secondary">
            <Icon path={ICON_PATHS.lockClock} className="w-7 h-7" />
          </div>
          <h1 className="text-headline-md text-primary">{t("heading")}</h1>
          <p className="text-body-md text-on-surface-variant">
            {t("subtitle")}
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
            <Label htmlFor="totp-code">{t("codeLabel")}</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={code.length !== 6 || busy}
            className="w-full justify-center"
          >
            {busy ? <Spinner size="sm" /> : t("verify")}
          </Button>
        </form>

        <div className="text-center space-y-3">
          {gate.recoveryBound ? (
            <Link
              href="/login/totp/recovery"
              className="text-body-md text-secondary hover:underline"
            >
              {t("useRecovery")}
            </Link>
          ) : (
            <p className="text-body-md text-on-surface-variant">
              {t("recoveryNotConfigured")}
            </p>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="text-label-md text-on-surface-variant hover:underline"
          >
            {t("signOut")}
          </button>
        </div>
      </div>
    </main>
  );
}
