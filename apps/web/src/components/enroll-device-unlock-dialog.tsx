"use client";

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

type Method = "pin" | "biometric" | "hardware-key";

interface EnrollDeviceUnlockDialogProps {
  userEmail: string;
  onClose: () => void;
}

export function EnrollDeviceUnlockDialog({
  userEmail,
  onClose,
}: EnrollDeviceUnlockDialogProps) {
  const { masterKey } = useMasterKey();
  const { enroll } = useDeviceUnlock({ userEmail });
  const [method, setMethod] = useState<Method | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hardwareAvailable, setHardwareAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricAvailable);
    setHardwareAvailable(isWebAuthnSupported());
  }, []);

  if (!masterKey) return null;

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== pinConfirm) {
      setError("PINs do not match");
      return;
    }
    if (pin.length < PIN_MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_MIN_LENGTH} digits`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await enroll(masterKey!, { method: "pin", pin });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not enroll PIN"));
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
      setError(getErrorMessage(err, "Could not enroll authenticator"));
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
          Speed up future unlocks
        </h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          Choose at least one method so you don&apos;t have to type your 24
          words on this device next time.
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
              <div className="font-bold text-on-surface">PIN</div>
              <div className="text-xs text-on-surface-variant mt-1">
                A {PIN_MIN_LENGTH}+ digit code stored only on this device
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleWebAuthnSubmit("platform")}
              disabled={!biometricAvailable || busy}
              className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors disabled:opacity-60"
            >
              <div className="font-bold text-on-surface">
                Biometric (Face ID / Touch ID / Windows Hello)
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {biometricAvailable
                  ? "Use your platform authenticator"
                  : "Not available on this device"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleWebAuthnSubmit("cross-platform")}
              disabled={!hardwareAvailable || busy}
              className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors disabled:opacity-60"
            >
              <div className="font-bold text-on-surface">
                Hardware security key
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {hardwareAvailable
                  ? "YubiKey or other roaming authenticator"
                  : "WebAuthn not supported"}
              </div>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-on-surface-variant hover:underline mt-4"
            >
              Skip for now
            </button>
          </div>
        ) : null}

        {method === "pin" ? (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enroll-pin">New PIN</Label>
              <Input
                id="enroll-pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder={`At least ${PIN_MIN_LENGTH} digits`}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-pin-confirm">Confirm PIN</Label>
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
              {busy ? <Spinner size="sm" /> : "Save PIN"}
            </Button>
            <button
              type="button"
              onClick={() => setMethod(null)}
              disabled={busy}
              className="w-full text-sm text-on-surface-variant hover:underline"
            >
              Back
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
