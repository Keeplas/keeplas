import { useState } from "react";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Button, Label, PasswordInput, Spinner } from "@keeplas/ui";
import { PIN_MIN_LENGTH } from "@/lib/device-unlock";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface EnrollDeviceUnlockDialogProps {
  user: Doc<"users">;
  onClose: () => void;
}

export function EnrollDeviceUnlockDialog({
  user,
  onClose,
}: EnrollDeviceUnlockDialogProps) {
  const t = useTranslations("settingsSecurity");
  const common = useTranslations("common");
  const { masterKey } = useMasterKey();
  const { enroll } = useDeviceUnlock(user);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!masterKey) return null;

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== pinConfirm) {
      setError(t("enroll.pinMismatch"));
      return;
    }
    if (pin.length < PIN_MIN_LENGTH) {
      setError(t("enroll.pinTooShort", { min: PIN_MIN_LENGTH }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await enroll(masterKey!, { method: "pin", pin });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t("enroll.pinError")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-sm p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-headline-sm text-primary mb-2">
          {t("enroll.title")}
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          {t("enroll.description")}
        </p>

        {error ? (
          <div className="mb-4 p-3 bg-error-container rounded-xs text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enroll-pin">{t("enroll.newPinLabel")}</Label>
            <PasswordInput
              id="enroll-pin"
              showLabel={common("showSecret")}
              hideLabel={common("hideSecret")}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder={t("enroll.pinPlaceholder", {
                min: PIN_MIN_LENGTH,
              })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enroll-pin-confirm">
              {t("enroll.confirmPinLabel")}
            </Label>
            <PasswordInput
              id="enroll-pin-confirm"
              showLabel={common("showSecret")}
              hideLabel={common("hideSecret")}
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={busy || pin.length < PIN_MIN_LENGTH}
            className="w-full"
          >
            {busy ? <Spinner size="sm" /> : t("enroll.savePin")}
          </Button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full text-sm text-on-surface-variant hover:underline"
          >
            {t("enroll.skip")}
          </button>
        </form>
      </div>
    </div>
  );
}
