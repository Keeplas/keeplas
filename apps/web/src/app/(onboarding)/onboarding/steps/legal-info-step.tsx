import { useMemo, useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, DatePicker, ErrorAlert, Label } from "@keeplas/ui";
import { CountryCombobox } from "@/components/country-combobox";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRequestContext } from "@/lib/use-request-context";
import { isValidCountryCode } from "@/lib/countries";
import { useTranslations } from "@/lib/i18n";

const ISO_MIN = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 130);
  return d.toISOString().slice(0, 10);
})();

const ISO_MAX_FOR_18 = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
})();

interface LegalInfoStepProps {
  onComplete: () => void;
}

export function LegalInfoStep({ onComplete }: LegalInfoStepProps) {
  const t = useTranslations("auth.onboarding.legalInfo");
  const requestCtx = useRequestContext();
  const completeLegalInfo = useAuditedMutation(api.users.completeLegalInfo);

  const [birthday, setBirthday] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill country from the server-attested geo header once the audit
  // context resolves. Only seeds the field — the user can always change it.
  // Adjusting during render avoids a setState-in-effect sync.
  const [seededCtx, setSeededCtx] = useState(requestCtx);
  if (requestCtx !== seededCtx) {
    setSeededCtx(requestCtx);
    if (
      !country &&
      requestCtx?.country &&
      isValidCountryCode(requestCtx.country)
    ) {
      setCountry(requestCtx.country.toUpperCase());
    }
  }

  // Anchor "now" once at mount so the age check stays pure across renders.
  const [now] = useState(() => Date.now());
  const ageError = useMemo(() => {
    if (!birthday) return null;
    const ts = Date.parse(birthday);
    if (Number.isNaN(ts)) return t("invalidDate");
    const ageMs = now - ts;
    const eighteenMs = 18 * 365.25 * 24 * 60 * 60 * 1000;
    if (ageMs < eighteenMs) return t("minAge");
    return null;
  }, [birthday, now, t]);

  const canSubmit =
    !!birthday && !!country && !ageError && !submitting && !!requestCtx;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const ts = Date.parse(birthday);
      if (Number.isNaN(ts)) throw new Error("Invalid date");
      await completeLegalInfo({ birthday: ts, country });
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed");
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg mb-6">
          <span className="text-label-md uppercase tracking-widest">
            {t("badge")}
          </span>
        </div>
        <h2 className="text-headline-lg text-primary mb-3 text-balance">
          {t("heading")}
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-md mx-auto">
          {t("description")}
        </p>
      </div>

      {error && <ErrorAlert message={error} className="mb-6" />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="birthday">{t("birthday")}</Label>
          <DatePicker
            id="birthday"
            value={birthday}
            onChange={setBirthday}
            min={ISO_MIN}
            max={ISO_MAX_FOR_18}
            placeholder={t("birthdayPlaceholder")}
          />
          {ageError && <p className="text-body-sm text-error">{ageError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">{t("country")}</Label>
          <CountryCombobox id="country" value={country} onChange={setCountry} />
        </div>

        <Button
          type="submit"
          variant="vault"
          size="lg"
          disabled={!canSubmit}
          className="w-full justify-center"
        >
          {submitting
            ? t("saving")
            : !requestCtx && !!birthday && !!country && !ageError
              ? t("securing")
              : t("submit")}
        </Button>
      </form>
    </div>
  );
}
