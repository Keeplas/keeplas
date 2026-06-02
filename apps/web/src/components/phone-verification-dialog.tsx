import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Icon,
  Input,
  Label,
  PhoneInput,
  isValidPhone,
  type CountryCode,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useResendCooldown } from "@/lib/use-resend-cooldown";
import { useTranslations } from "@/lib/i18n";

type Step = "phone" | "code";
type Mode = "add" | "change";

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
  defaultCountry?: CountryCode;
  /**
   * "add" (default) when the user has no verified phone yet; "change" when
   * they already do — only the copy changes, the OTP flow is identical.
   */
  mode?: Mode;
  onVerified?: () => void;
}

export function PhoneVerificationDialog({
  open,
  onOpenChange,
  initialPhone,
  defaultCountry,
  mode = "add",
  onVerified,
}: PhoneVerificationDialogProps) {
  const t = useTranslations("chrome");
  const status = useQuery(api.phone_verification.getMyStatus);
  const requestVerification = useMutation(
    api.phone_verification.requestVerification,
  );
  const verifyCode = useAuditedMutation(api.phone_verification.verifyCode);

  const [step, setStep] = useState<Step>(initialPhone ? "phone" : "phone");
  const [phone, setPhone] = useState<string | undefined>(initialPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useResendCooldown(30);

  // Reset the flow each time the dialog opens, jumping straight to the code
  // step when a verification code is already pending. Adjusting during render
  // avoids setState-in-effect syncs.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(status?.hasPendingCode ? "code" : "phone");
      setPhone(status?.pendingPhone ?? initialPhone);
      setCode("");
      setError(null);
    }
  }

  // The pending-code status may resolve after the dialog is already open —
  // skip the phone step once it does.
  const [prevPending, setPrevPending] = useState(status?.hasPendingCode);
  if (status?.hasPendingCode !== prevPending) {
    setPrevPending(status?.hasPendingCode);
    if (open && status?.hasPendingCode && step === "phone") {
      setPhone(status?.pendingPhone ?? phone);
      setStep("code");
    }
  }

  async function handleSendCode() {
    if (!phone || !isValidPhone(phone)) {
      setError(t("phoneVerify.invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ phoneNumber: phone });
      cooldown.start();
      setStep("code");
    } catch (err) {
      setError(getErrorMessage(err, t("phoneVerify.couldNotSend")));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("phoneVerify.enterCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode({ code: code.trim() });
      onVerified?.();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, t("phoneVerify.verificationFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!phone || cooldown.active) return;
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ phoneNumber: phone });
      cooldown.start();
      setCode("");
    } catch (err) {
      setError(getErrorMessage(err, t("phoneVerify.couldNotResend")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-5 items-start static">
          <div className="space-y-1.5">
            <DialogTitle>
              {mode === "change"
                ? t("phoneVerify.titleChange")
                : t("phoneVerify.titleAdd")}
            </DialogTitle>
            <DialogDescription>
              {mode === "change"
                ? t("phoneVerify.descChange")
                : t("phoneVerify.descAdd")}
            </DialogDescription>
          </div>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <Icon
              path={ICON_PATHS.close}
              className="w-5 h-5 text-on-surface-variant"
              strokeWidth={2}
            />
          </DialogClose>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2 space-y-4">
          {error && <ErrorAlert message={error} />}

          {step === "phone" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-phone">
                  {t("phoneVerify.phoneLabel")}
                </Label>
                <PhoneInput
                  id="verify-phone"
                  value={phone}
                  onChange={setPhone}
                  defaultCountry={defaultCountry}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  {t("phoneVerify.cancel")}
                </Button>
                <Button
                  onClick={handleSendCode}
                  disabled={busy || !phone || !isValidPhone(phone)}
                >
                  {busy ? t("phoneVerify.sending") : t("phoneVerify.sendCode")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-code">
                  {t("phoneVerify.codeLabel")}
                </Label>
                <Input
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                />
                <p className="text-label-md text-on-surface-variant">
                  {t("phoneVerify.sentTo", { phone })}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={busy || cooldown.active}
                >
                  {cooldown.active
                    ? t("phoneVerify.resendIn", { seconds: cooldown.remaining })
                    : t("phoneVerify.resendCode")}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("phone")}
                    disabled={busy}
                  >
                    {t("phoneVerify.changeNumber")}
                  </Button>
                  <Button type="submit" disabled={busy || code.length !== 6}>
                    {busy
                      ? t("phoneVerify.verifying")
                      : t("phoneVerify.verify")}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
