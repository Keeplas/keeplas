import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "@/lib/navigation";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon, Spinner } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import {
  getPasskeyErrorMessage,
  registerPasskey,
  usePasskeySupport,
} from "@/lib/passkey";
import { useTranslations } from "@/lib/i18n";

export function PasskeyStep() {
  const t = useTranslations("auth.onboarding.passkey");
  const router = useRouter();
  const startRegistration = useMutation(api.webauthn.startRegistration);
  const finishRegistration = useMutation(api.webauthn.finishRegistration);
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey({
        startRegistration: (args) => startRegistration(args),
        finishRegistration: (args) => finishRegistration(args),
      });
      setDone(true);
      setTimeout(() => router.push("/hub"), 900);
    } catch (err) {
      setError(getPasskeyErrorMessage(err, t("registerFailed")));
      setBusy(false);
    }
  }

  function handleSkip() {
    router.push("/hub");
  }

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg mb-6">
          <Icon path={ICON_PATHS.face} className="w-5 h-5" />
          <span className="text-label-md">{t("badge")}</span>
        </div>
        <h2 className="text-headline-lg text-primary mb-3 break-words">
          {done ? t("headingDone") : t("heading")}
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-sm mx-auto">
          {done ? t("descriptionDone") : t("description")}
        </p>
      </div>

      {!supported && !done && (
        <div className="bg-surface-container-low p-4 rounded-xl mb-6 text-left">
          <p className="text-body-md text-on-surface-variant">
            {t("unsupportedBefore")} <strong>{t("unsupportedTerm")}</strong>{" "}
            {t("unsupportedAfter")}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-error-container p-4 rounded-xl mb-6 text-left">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button
          variant="vault"
          size="lg"
          onClick={handleEnable}
          disabled={!supported || busy || done}
          className="w-full justify-center gap-2"
        >
          {busy ? (
            <Spinner size="sm" />
          ) : (
            <Icon path={ICON_PATHS.fingerprint} className="w-5 h-5" />
          )}
          <span>{done ? t("redirecting") : t("enable")}</span>
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy || done}
          className="text-body-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
