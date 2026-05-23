"use client";

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
  isValidEmail,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useResendCooldown } from "@/lib/use-resend-cooldown";

type Step = "email" | "code";

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  onVerified?: () => void;
}

/**
 * Add + verify an email for the signed-in account. On success the backend links
 * a passwordless `email-otp` auth account, so the email becomes a login method.
 * Sibling of PhoneVerificationDialog (email instead of phone OTP).
 */
export function EmailVerificationDialog({
  open,
  onOpenChange,
  initialEmail,
  onVerified,
}: EmailVerificationDialogProps) {
  const status = useQuery(api.email_verification.getMyStatus);
  const requestVerification = useMutation(
    api.email_verification.requestVerification,
  );
  const verifyCodeAndLink = useMutation(
    api.email_verification.verifyCodeAndLink,
  );

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useResendCooldown(30);

  // Reset the flow each time the dialog opens, jumping to the code step when a
  // code is already pending. Adjusting during render avoids effect syncs.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(status?.hasPendingCode ? "code" : "email");
      setEmail(status?.pendingEmail ?? initialEmail ?? "");
      setCode("");
      setError(null);
    }
  }

  const [prevPending, setPrevPending] = useState(status?.hasPendingCode);
  if (status?.hasPendingCode !== prevPending) {
    setPrevPending(status?.hasPendingCode);
    if (open && status?.hasPendingCode && step === "email") {
      setEmail(status?.pendingEmail ?? email);
      setStep("code");
    }
  }

  async function handleSendCode() {
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ email: email.trim() });
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
      await verifyCodeAndLink({ code: code.trim() });
      onVerified?.();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Verification failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!isValidEmail(email) || cooldown.active) return;
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ email: email.trim() });
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
            <DialogTitle>Add an email</DialogTitle>
            <DialogDescription>
              We will email you a 6-digit code. Confirm it to add this email —
              you can then sign in with an emailed code, no password.
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

          {step === "email" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-email">Email address</Label>
                <Input
                  id="verify-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
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
                  disabled={busy || !isValidEmail(email)}
                >
                  {busy ? "Sending…" : "Send code"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-email-code">6-digit code</Label>
                <Input
                  id="verify-email-code"
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
                  Sent to {email}. The code expires in 10 minutes.
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
                    onClick={() => setStep("email")}
                    disabled={busy}
                  >
                    Change email
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
