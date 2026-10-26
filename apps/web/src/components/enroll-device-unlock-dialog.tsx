import { useState } from "react";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Icon,
  Label,
  PasswordInput,
  Spinner,
} from "@keeplas/ui";
import { PIN_LENGTH } from "@/lib/device-unlock";
import { ICON_PATHS } from "@/lib/icons";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface EnrollDeviceUnlockDialogProps {
  user: Doc<"users">;
  onClose: () => void;
}

const REASONS = ["why1", "why2", "why3"] as const;

/** Add a 4-digit Keeplas code to this browser, with why it matters. */
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

  const digits = (value: string) =>
    value.replace(/\D/g, "").slice(0, PIN_LENGTH);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        overlayClassName="bg-scrim backdrop-blur-none"
        className="flex max-h-[90vh] max-w-md flex-col gap-[16px] overflow-y-auto rounded-[20px] bg-bg-surface p-[24px]"
      >
        <DialogTitle className="text-h2 text-text-primary">
          {t("enroll.title")}
        </DialogTitle>
        <DialogDescription className="text-body text-text-muted">
          {t("enroll.description", { n: PIN_LENGTH })}
        </DialogDescription>

        <section className="flex flex-col gap-[10px] rounded-[14px] border border-border-default p-[14px]">
          <h3 className="flex items-center gap-[8px] text-label text-text-primary">
            <Icon
              path={ICON_PATHS.shieldCheck}
              className="size-[18px] text-text-accent"
            />
            {t("enroll.whyTitle")}
          </h3>
          <ul className="flex flex-col gap-[8px]">
            {REASONS.map((key) => (
              <li
                key={key}
                className="flex gap-[10px] text-body-sm text-text-body"
              >
                <Icon
                  path={ICON_PATHS.check}
                  className="mt-[1px] size-[16px] shrink-0 text-status-active"
                />
                {t(`enroll.${key}`, { n: PIN_LENGTH })}
              </li>
            ))}
          </ul>
        </section>

        {error ? (
          <p role="alert" className="text-body-sm text-action-danger">
            {error}
          </p>
        ) : null}

        <form onSubmit={handlePinSubmit} className="flex flex-col gap-[14px]">
          <div className="flex flex-col gap-[8px]">
            <Label htmlFor="enroll-pin">
              {t("enroll.newPinLabel", { n: PIN_LENGTH })}
            </Label>
            <PasswordInput
              id="enroll-pin"
              showLabel={common("showSecret")}
              hideLabel={common("hideSecret")}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => setPin(digits(e.target.value))}
              required
            />
          </div>
          <div className="flex flex-col gap-[8px]">
            <Label htmlFor="enroll-pin-confirm">
              {t("enroll.confirmPinLabel")}
            </Label>
            <PasswordInput
              id="enroll-pin-confirm"
              showLabel={common("showSecret")}
              hideLabel={common("hideSecret")}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(digits(e.target.value))}
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="cta"
            disabled={
              busy ||
              pin.length !== PIN_LENGTH ||
              pinConfirm.length !== PIN_LENGTH
            }
            className="w-full"
          >
            {busy ? <Spinner size="sm" /> : t("enroll.savePin")}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={onClose}
            disabled={busy}
            className="text-button"
          >
            {t("enroll.skip")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
