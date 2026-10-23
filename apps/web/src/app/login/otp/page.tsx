import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button, Loader } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { getErrorMessage } from "@/lib/utils";
import { useResendCooldown } from "@/lib/use-resend-cooldown";
import { useTranslations } from "@/lib/i18n";
import { VerifyCodeScreen } from "@/components/verify-code-screen";

export default function LoginOtpPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations("auth.otp");
  const c = useTranslations("common");
  const gate = useQuery(
    api.login_otp.getMyLoginOtpGate,
    isAuthenticated ? {} : "skip",
  );
  const request = useMutation(api.login_otp.requestLoginOtp);
  const submit = useMutation(api.login_otp.submitLoginOtpForSession);

  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    remaining: cooldownRemaining,
    active: cooldownActive,
    start: startCooldown,
  } = useResendCooldown(30);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (gate && !gate.required && gate.authenticated) {
      router.push("/hub");
    }
  }, [gate, router]);

  // Send the first code automatically once the gate confirms it's required.
  useEffect(() => {
    if (!gate?.required || requestedRef.current) return;
    requestedRef.current = true;
    request()
      .then((r) => {
        if (r.sent === false && !("alreadyCleared" in r)) {
          setError(t("noChannel"));
        } else {
          startCooldown();
        }
      })
      .catch((err) => setError(getErrorMessage(err, t("sendFailed"))));
  }, [gate?.required, request, startCooldown, t]);

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

  async function handleResend() {
    if (resending || cooldownActive) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await request();
      startCooldown();
      setNotice(t("resent"));
    } catch (err) {
      setError(getErrorMessage(err, t("resendFailed")));
    } finally {
      setResending(false);
    }
  }

  return (
    <VerifyCodeScreen
      namespace="auth.otp"
      body={
        gate.channelMasked
          ? t("subtitleChannel", { channel: gate.channelMasked })
          : t("subtitle")
      }
      busy={busy}
      error={error}
      notice={notice}
      onSubmit={handleSubmit}
    >
      <Button
        type="button"
        variant="link"
        onClick={handleResend}
        disabled={resending || cooldownActive}
        className="text-button"
      >
        {resending
          ? t("sending")
          : cooldownActive
            ? c("resendIn", { seconds: cooldownRemaining })
            : t("resend")}
      </Button>
    </VerifyCodeScreen>
  );
}
