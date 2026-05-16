"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button, Icon, Input, Label, Loader, Spinner } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function LoginOtpPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const gate = useQuery(
    api.login_otp.getMyLoginOtpGate,
    isAuthenticated ? {} : "skip",
  );
  const request = useMutation(api.login_otp.requestLoginOtp);
  const submit = useMutation(api.login_otp.submitLoginOtpForSession);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (gate && !gate.required && gate.authenticated) {
      router.push("/hub");
    }
  }, [gate, router]);

  // Send the first code automatically once the gate confirms it's required.
  useEffect(() => {
    if (!gate?.required || requestedRef.current) return;
    requestedRef.current = true;
    request()
      .then((r) => {
        if (r.sent === false && !("alreadyCleared" in r)) {
          setError("No verification channel available for this account.");
        }
      })
      .catch((err) => setError(getErrorMessage(err, "Could not send code.")));
  }, [gate?.required, request]);

  if (isLoading || gate === undefined) {
    return <Loader fullscreen label="Verifying session" />;
  }
  if (!isAuthenticated || !gate.authenticated) return null;
  if (!gate.required) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ code: code.trim() });
      router.push("/hub");
    } catch (err) {
      setError(getErrorMessage(err, "Verification failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await request();
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not resend the code."));
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-secondary/15 items-center justify-center text-secondary">
            <Icon path={ICON_PATHS.lockClock} className="w-7 h-7" />
          </div>
          <h1 className="text-headline-md text-primary">
            Confirm it&apos;s you
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {gate.channelMasked
              ? `Enter the 6-digit code we sent to ${gate.channelMasked} to finish signing in.`
              : "Enter the 6-digit code to finish signing in."}
          </p>
        </div>

        {error && (
          <div className="bg-error-container/40 p-3 rounded-xl">
            <p className="text-body-md text-on-error-container">{error}</p>
          </div>
        )}
        {notice && !error && (
          <div className="bg-secondary/10 p-3 rounded-xl">
            <p className="text-body-md text-on-surface-variant">{notice}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest p-6 rounded-2xl space-y-4 ghost-border"
        >
          <div className="space-y-1.5">
            <Label htmlFor="login-otp-code">6-digit code</Label>
            <Input
              id="login-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
          </div>
          <Button
            type="submit"
            variant="vault"
            size="md"
            disabled={code.length !== 6 || busy}
            className="w-full justify-center"
          >
            {busy ? <Spinner size="sm" /> : "Verify"}
          </Button>
        </form>

        <div className="text-center space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-body-md text-secondary hover:underline disabled:opacity-60"
          >
            {resending ? "Sending…" : "Didn't get it? Resend code"}
          </button>
          {gate.recoveryBound ? (
            <Link
              href="/login/otp/recovery"
              className="block text-body-md text-secondary hover:underline"
            >
              Can&apos;t receive the code? Use your recovery phrase
            </Link>
          ) : (
            <p className="text-body-md text-on-surface-variant">
              Recovery via seed is not configured for this account.
            </p>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="text-label-md text-on-surface-variant hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
