"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { phraseToTotpResetVerifier } from "@keeplas/crypto";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Loader,
  Spinner,
  Textarea,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";
import { getErrorMessage } from "@/lib/utils";

type EnrollmentSession = {
  secret: string;
  uri: string;
  account: string;
};

type DialogPhase = "code" | "bind-recovery";
type BindMode = "enrollment" | "post-hoc";

export function TotpManager() {
  const status = useQuery(api.totp.getMyTotpStatus);
  const startEnrollment = useMutation(api.totp.startEnrollment);
  const verifyAndEnable = useMutation(api.totp.verifyAndEnable);
  const cancelEnrollment = useMutation(api.totp.cancelEnrollment);
  const bindRecoveryReset = useMutation(api.totp.bindRecoveryReset);
  const disable = useMutation(api.totp.disable);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>("code");
  const [bindMode, setBindMode] = useState<BindMode>("enrollment");
  const [session, setSession] = useState<EnrollmentSession | null>(null);
  const [code, setCode] = useState("");
  const [phrase, setPhrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<
    "starting" | "verifying" | "binding" | "disabling" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (status === undefined) {
    return (
      <section className="md:col-span-6 bg-surface-container-highest p-6 md:p-8 rounded-2xl">
        <Loader label="Loading authenticator app" />
      </section>
    );
  }

  function resetDialog() {
    setSession(null);
    setCode("");
    setPhrase("");
    setShowSecret(false);
    setError(null);
    setCopied(false);
    setPhase("code");
    setBindMode("enrollment");
  }

  async function handleStart() {
    setBusy("starting");
    setError(null);
    try {
      const result = await startEnrollment({});
      setSession({
        secret: result.secret,
        uri: result.uri,
        account: result.account,
      });
      setPhase("code");
      setBindMode("enrollment");
      setOpen(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start enrollment."));
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("verifying");
    setError(null);
    try {
      await verifyAndEnable({ code: code.trim() });
      setPhase("bind-recovery");
      setBindMode("enrollment");
    } catch (err) {
      setError(getErrorMessage(err, "Verification failed."));
    } finally {
      setBusy(null);
    }
  }

  function openBindDialog() {
    setPhase("bind-recovery");
    setBindMode("post-hoc");
    setPhrase("");
    setError(null);
    setOpen(true);
  }

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const words = phrase
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase());
    if (words.length !== 24) {
      setError("Please enter all 24 words of your recovery phrase.");
      return;
    }
    setBusy("binding");
    setError(null);
    try {
      const verifierHash = await phraseToTotpResetVerifier(words);
      await bindRecoveryReset({ recoveryVerifierHash: verifierHash });
      setOpen(false);
      resetDialog();
    } catch (err) {
      setError(getErrorMessage(err, "Could not bind the recovery phrase."));
    } finally {
      setBusy(null);
    }
  }

  function handleSkipBind() {
    setOpen(false);
    resetDialog();
  }

  async function handleCloseDialog(nextOpen: boolean) {
    if (nextOpen) return;
    if (phase === "code" && session && !status?.enrolled) {
      try {
        await cancelEnrollment({});
      } catch {
        /* best-effort */
      }
    }
    setOpen(false);
    resetDialog();
  }

  async function handleDisable() {
    if (
      !window.confirm(
        "Disable the authenticator app? You will lose this second factor and may need to set it up again.",
      )
    ) {
      return;
    }
    setBusy("disabling");
    setError(null);
    try {
      await disable({});
    } catch (err) {
      setError(getErrorMessage(err, "Could not disable authenticator."));
    } finally {
      setBusy(null);
    }
  }

  async function handleCopySecret() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const enrolled = status?.enrolled ?? false;
  const recoveryBound = status?.recoveryBound ?? false;

  return (
    <section className="md:col-span-6 bg-surface-container-highest p-6 md:p-8 rounded-2xl flex flex-col space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-headline-md text-primary">Authenticator App</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Use a TOTP app (Google Authenticator, 1Password, Authy) as an
            alternative to passkey.
          </p>
        </div>
        <Icon
          path={ICON_PATHS.lockClock}
          className="w-7 h-7 text-secondary shrink-0"
        />
      </div>

      {error && (
        <div className="bg-error-container/40 p-3 rounded-xl">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      {enrolled ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3.5 bg-surface-container-lowest rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                <Icon path={ICON_PATHS.verifiedFill} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-body-md font-bold text-primary truncate">
                  Authenticator enrolled
                </p>
                <p className="text-body-md text-on-surface-variant truncate">
                  {status.verifiedAt
                    ? `Verified ${formatTimeAgo(status.verifiedAt)}`
                    : "Verified"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy !== null}
              className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40 shrink-0"
              aria-label="Disable authenticator app"
            >
              {busy === "disabling" ? (
                <Spinner size="sm" />
              ) : (
                <Icon path={ICON_PATHS.close} className="w-5 h-5" />
              )}
            </button>
          </div>

          <div
            className={
              recoveryBound
                ? "flex items-center gap-3 p-3 bg-secondary-container/30 rounded-xl"
                : "flex items-center justify-between gap-3 p-3 bg-surface-container-lowest rounded-xl"
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon
                path={
                  recoveryBound ? ICON_PATHS.verifiedUser : ICON_PATHS.warning
                }
                className={
                  recoveryBound
                    ? "w-5 h-5 text-secondary shrink-0"
                    : "w-5 h-5 text-error shrink-0"
                }
              />
              <p className="text-body-md text-on-surface-variant">
                {recoveryBound
                  ? "Recovery via seed phrase: ON"
                  : "Recovery via seed phrase: OFF — you cannot reset 2FA if you lose your phone."}
              </p>
            </div>
            {!recoveryBound && (
              <button
                type="button"
                onClick={openBindDialog}
                className="text-secondary hover:underline text-label-md font-bold shrink-0"
              >
                Set up
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 text-center">
          <Icon
            path={ICON_PATHS.lockClock}
            className="w-10 h-10 mx-auto mb-3 text-outline-variant"
          />
          <p className="text-body-md text-on-surface-variant">
            No authenticator app configured.
          </p>
        </div>
      )}

      <Button
        type="button"
        variant="vault"
        size="md"
        onClick={handleStart}
        disabled={enrolled || busy !== null}
        className="w-full justify-center gap-2"
      >
        {busy === "starting" ? (
          <Spinner size="sm" />
        ) : (
          <Icon path={ICON_PATHS.plus} className="w-4 h-4" />
        )}
        <span>
          {enrolled ? "Authenticator active" : "Set up authenticator"}
        </span>
      </Button>

      <div className="flex items-start gap-3 bg-surface-container-lowest p-4 rounded-xl mt-auto">
        <Icon
          path={ICON_PATHS.shieldCheck}
          className="w-5 h-5 text-secondary shrink-0 mt-0.5"
        />
        <p className="text-body-md text-on-surface-variant">
          Codes are generated on your device and rotate every 30 seconds. Pair
          this with a printed recovery kit so you keep access if the phone is
          lost.
        </p>
      </div>

      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {phase === "code"
                ? "Set up authenticator app"
                : "Tie 2FA to your recovery phrase"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-5">
            {phase === "code" && (
              <>
                <DialogDescription>
                  Open your authenticator app, scan the QR code below, then
                  enter the 6-digit code to confirm.
                </DialogDescription>

                {session ? (
                  <>
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-xl">
                        <QRCode
                          value={session.uri}
                          size={192}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#041632"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowSecret((s) => !s)}
                        className="text-body-md text-secondary hover:underline"
                      >
                        {showSecret
                          ? "Hide"
                          : "Can't scan? Enter the key manually"}
                      </button>
                      {showSecret && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-surface-container rounded-xl">
                          <code className="font-mono text-body-md text-primary break-all">
                            {session.secret.match(/.{1,4}/g)?.join(" ")}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopySecret}
                            className="text-secondary hover:underline text-label-md font-bold shrink-0"
                          >
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleVerify} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="totp-code">6-digit code</Label>
                        <Input
                          id="totp-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="\d{6}"
                          maxLength={6}
                          placeholder="123456"
                          value={code}
                          onChange={(e) =>
                            setCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          onClick={() => handleCloseDialog(false)}
                          disabled={busy !== null}
                          className="flex-1 justify-center"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="vault"
                          size="md"
                          disabled={code.length !== 6 || busy !== null}
                          className="flex-1 justify-center"
                        >
                          {busy === "verifying" ? (
                            <Spinner size="sm" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="py-12 flex justify-center">
                    <Spinner />
                  </div>
                )}
              </>
            )}

            {phase === "bind-recovery" && (
              <>
                <DialogDescription>
                  {bindMode === "enrollment"
                    ? "Authenticator enabled. Optionally bind your recovery phrase so you can disable 2FA if you ever lose your phone."
                    : "Bind your recovery phrase so you can disable 2FA if you ever lose your phone."}
                </DialogDescription>
                <form onSubmit={handleBind} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="recovery-phrase">Recovery phrase</Label>
                    <Textarea
                      id="recovery-phrase"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      placeholder="word1 word2 word3 ..."
                      rows={4}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-label-md text-on-surface-variant">
                      The phrase never leaves your device — only a derived
                      verifier is sent.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {bindMode === "enrollment" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={handleSkipBind}
                        disabled={busy !== null}
                        className="flex-1 justify-center"
                      >
                        Skip
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => handleCloseDialog(false)}
                        disabled={busy !== null}
                        className="flex-1 justify-center"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="vault"
                      size="md"
                      disabled={phrase.trim().length === 0 || busy !== null}
                      className="flex-1 justify-center"
                    >
                      {busy === "binding" ? (
                        <Spinner size="sm" />
                      ) : (
                        "Bind recovery"
                      )}
                    </Button>
                  </div>
                </form>
                {bindMode === "enrollment" && (
                  <p className="text-label-md text-on-surface-variant">
                    Skipping is fine. Without binding, losing your phone means
                    you must contact support to reset 2FA.
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
