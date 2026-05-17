"use client";

import { useEffect, useState } from "react";
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
import { useResendCooldown } from "@/lib/use-resend-cooldown";

type Step = "phone" | "code";

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
  defaultCountry?: CountryCode;
  onVerified?: () => void;
}

export function PhoneVerificationDialog({
  open,
  onOpenChange,
  initialPhone,
  defaultCountry,
  onVerified,
}: PhoneVerificationDialogProps) {
  const status = useQuery(api.phone_verification.getMyStatus);
  const requestVerification = useMutation(
    api.phone_verification.requestVerification,
  );
  const verifyCode = useMutation(api.phone_verification.verifyCode);

  const [step, setStep] = useState<Step>(initialPhone ? "phone" : "phone");
  const [phone, setPhone] = useState<string | undefined>(initialPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useResendCooldown(30);

  useEffect(() => {
    if (!open) return;
    setStep("phone");
    setPhone(initialPhone);
    setCode("");
    setError(null);
  }, [open, initialPhone]);

  // Skip the phone step if the user already has a pending non-expired code.
  useEffect(() => {
    if (open && status?.hasPendingCode && step === "phone") {
      setStep("code");
    }
  }, [open, status?.hasPendingCode, step]);

  async function handleSendCode() {
    if (!phone || !isValidPhone(phone)) {
      setError("Enter a valid phone number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ phoneNumber: phone });
      cooldown.start();
      setStep("code");
    } catch (err) {
      setError(getErrorMessage(err, "Could not send verification code."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode({ code: code.trim() });
      onVerified?.();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Verification failed."));
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
      setError(getErrorMessage(err, "Could not resend code."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-5 items-start static">
          <div className="space-y-1.5">
            <DialogTitle>Verify your WhatsApp number</DialogTitle>
            <DialogDescription>
              We will send a 6-digit code to your WhatsApp. Enter it below to
              confirm ownership of this number.
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
                <Label htmlFor="verify-phone">WhatsApp number</Label>
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
                  Cancel
                </Button>
                <Button
                  onClick={handleSendCode}
                  disabled={busy || !phone || !isValidPhone(phone)}
                >
                  {busy ? "Sending…" : "Send code"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-code">6-digit code</Label>
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
                  Sent to {phone}. The code expires in 10 minutes.
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
                    ? `Resend code in ${cooldown.remaining}s`
                    : "Resend code"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("phone")}
                    disabled={busy}
                  >
                    Change number
                  </Button>
                  <Button type="submit" disabled={busy || code.length !== 6}>
                    {busy ? "Verifying…" : "Verify"}
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
