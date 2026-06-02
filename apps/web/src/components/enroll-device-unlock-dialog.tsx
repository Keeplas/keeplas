import { useEffect, useState } from "react";
import { Button, Input, Label, Spinner } from "@keeplas/ui";
import {
  PIN_MIN_LENGTH,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
} from "@/lib/device-unlock";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

type Method = "pin" | "biometric" | "hardware-key";

interface EnrollDeviceUnlockDialogProps {
  userEmail: string;
  onClose: () => void;
}

export function EnrollDeviceUnlockDialog({
  userEmail,
  onClose,
}: EnrollDeviceUnlockDialogProps) {
  const t = useTranslations("settingsSecurity");
  const { masterKey } = useMasterKey();
  const { enroll } = useDeviceUnlock({ userEmail });
  const [method, setMethod] = useState<Method | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hardwareAvailable] = useState(() => isWebAuthnSupported());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
  }, []);

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

  async function handleWebAuthnSubmit(
    attachment: "platform" | "cross-platform",
  ) {
    setBusy(true);
    setError("");
    try {
      await enroll(masterKey!, {
        method: attachment === "platform" ? "biometric" : "hardware-key",
        attachment,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t("enroll.authenticatorError")));
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
        className="bg-surface rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-headline-sm text-primary mb-2">
          {t("enroll.title")}
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          {t("enroll.description")}
        </p>

        {error ? (
          <div className="mb-4 p-3 bg-error-container rounded-xl text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        {!method ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMethod("pin")}
              className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors"
            >
              <div className="font-bold text-on-surface">
                {t("enroll.pinOption")}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {t("enroll.pinOptionHint", { min: PIN_MIN_LENGTH })}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleWebAuthnSubmit("platform")}
              disabled={!biometricAvailable || busy}
              className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors disabled:opacity-60"
            >
              <div className="font-bold text-on-surface">
                {t("enroll.biometricOption")}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {biometricAvailable
                  ? t("enroll.biometricAvailable")
                  : t("enroll.biometricUnavailable")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleWebAuthnSubmit("cross-platform")}
              disabled={!hardwareAvailable || busy}
              className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors disabled:opacity-60"
            >
              <div className="font-bold text-on-surface">
                {t("enroll.hardwareOption")}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {hardwareAvailable
                  ? t("enroll.hardwareAvailable")
                  : t("enroll.hardwareUnavailable")}
              </div>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-on-surface-variant hover:underline mt-4"
            >
              {t("enroll.skip")}
            </button>
          </div>
        ) : null}

        {method === "pin" ? (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enroll-pin">{t("enroll.newPinLabel")}</Label>
              <Input
                id="enroll-pin"
                type="password"
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
              <Input
                id="enroll-pin-confirm"
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, ""))
                }
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
              onClick={() => setMethod(null)}
              disabled={busy}
              className="w-full text-sm text-on-surface-variant hover:underline"
            >
              {t("enroll.back")}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
