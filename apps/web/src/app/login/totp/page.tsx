import { useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { VerifyCodeScreen } from "@/components/verify-code-screen";

export default function TotpLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations("auth.totp");
  const gate = useQuery(api.totp.getMyTotpGate, isAuthenticated ? {} : "skip");
  const submit = useMutation(api.totp.submitTotpForSession);

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

  async function handleSubmit(code: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await submit({ code });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/hub");
    } catch (err) {
      setError(getErrorMessage(err, t("verifyFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <VerifyCodeScreen
      namespace="auth.totp"
      body={t("subtitle")}
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
