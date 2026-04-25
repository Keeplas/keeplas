"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon, Spinner } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import {
  getPasskeyErrorMessage,
  registerPasskey,
  usePasskeySupport,
} from "@/lib/passkey";

export function PasskeyStep() {
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
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (err) {
      setError(getPasskeyErrorMessage(err, "Could not register your passkey."));
      setBusy(false);
    }
  }

  function handleSkip() {
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg mb-6">
          <Icon path={ICON_PATHS.face} className="w-5 h-5" />
          <span className="text-label-md">Optional · Faster sign in</span>
        </div>
        <h2 className="text-headline-lg md:text-display-lg text-primary mb-3 break-words">
          {done ? "Passkey ready" : "Sign in with your face"}
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-sm mx-auto">
          {done
            ? "You can now unlock Keeplas with your device biometrics."
            : "Use Face ID, Touch ID, or your device biometrics next time you sign in. Your password still works as a backup."}
        </p>
      </div>

      {!supported && !done && (
        <div className="bg-surface-container-low p-4 rounded-xl mb-6 text-left">
          <p className="text-body-md text-on-surface-variant">
            Passkeys are not supported on this browser. You can set this up
            later from <strong>Settings · Security Center</strong> on a
            compatible device.
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
          <span>{done ? "Redirecting..." : "Enable biometric sign in"}</span>
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy || done}
          className="text-body-md text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
