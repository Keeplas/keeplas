import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  buttonVariants,
  cn,
  Input,
  Label,
  Loader,
  Spinner,
} from "@keeplas/ui";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  PIN_MIN_LENGTH,
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
} from "@/lib/device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { classifyKeyBundle, parseKeyBundle } from "@/lib/key-bundle";
import { Link } from "@/lib/navigation";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "./auth-screen";
import { ContactDialog } from "./contact-dialog";

interface UnlockGateProps {
  children: React.ReactNode;
}

/**
 * Shown while the vault key is not in memory: unlock with a method of this
 * device (PIN, biometric, hardware key), or link this browser again from the
 * phone (W04-2). The 24-word phrase is never entered on the web.
 */
export function UnlockGate({ children }: UnlockGateProps) {
  const t = useTranslations("chrome");
  const { signOut } = useAuthActions();
  const { masterKey, setMasterKey, restoring } = useMasterKey();
  const user = useQuery(api.users.viewer);
  const { entries, loading: entriesLoading, unlock } = useDeviceUnlock(user);

  const [pinEntry, setPinEntry] = useState<DeviceUnlockEntry | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  const bundleString = user?.encryptedKeyBundle ?? null;
  const bundle = useMemo(() => parseKeyBundle(bundleString), [bundleString]);
  const bundleKind = classifyKeyBundle(bundle);

  if (user === undefined) {
    return <Loader fullscreen label={t("unlock.loadingVault")} />;
  }

  if (!user) return null;

  // Legacy V1 bundle: no client-side unwrap path remains (it was
  // server-decryptable). Block vault access with a clear re-key instruction
  // rather than silently leaving the vault unusable.
  if (bundleKind === "legacy-v1") {
    return <LegacyBundleNotice />;
  }

  // No vault key yet: nothing to unlock.
  if (bundleKind !== "v2" || masterKey) {
    return <>{children}</>;
  }

  // Still reading the persisted key from IndexedDB — show a loader instead of
  // flashing the unlock screen for a vault that's about to restore itself.
  if (restoring) {
    return <Loader fullscreen label={t("unlock.unlockingVault")} />;
  }

  if (entriesLoading) {
    return <Loader fullscreen label={t("unlock.checkingDeviceUnlock")} />;
  }

  async function handleUnlock(entry: DeviceUnlockEntry, secret?: string) {
    setBusy(true);
    setError("");
    try {
      setMasterKey(await unlock(entry.id, secret));
      setPin("");
    } catch (err) {
      setError(
        err instanceof DeviceUnlockError && err.code === "cancelled"
          ? t("unlock.authCancelled")
          : getErrorMessage(err, t("unlock.couldNotUnlock")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AuthScreen title={t("unlock.heroTitle")} body={t("unlock.heroBody")}>
        <div
          className={cn(
            authCardClass,
            "flex max-w-[456px] flex-col gap-[14px] p-[32px] shadow-card",
          )}
        >
          <h2 className="text-h2 text-text-primary">{t("unlock.heading")}</h2>
          <p className="text-body text-text-muted">
            {entries.length > 0
              ? t("unlock.subheading")
              : t("unlock.noDeviceUnlock")}
          </p>
          {error ? (
            <p role="alert" className="text-body-sm text-action-danger">
              {error}
            </p>
          ) : null}

          {pinEntry ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleUnlock(pinEntry, pin);
              }}
              className="flex flex-col gap-[14px]"
            >
              <Label htmlFor="unlock-pin">{pinEntry.label}</Label>
              <Input
                id="unlock-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder={t("unlock.pinPlaceholder", {
                  min: PIN_MIN_LENGTH,
                })}
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="cta"
                disabled={busy || pin.length < PIN_MIN_LENGTH}
                className="w-full"
              >
                {busy ? <Spinner size="sm" /> : t("unlock.unlockButton")}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setPinEntry(null);
                  setPin("");
                  setError("");
                }}
                disabled={busy}
                className="text-button"
              >
                {t("unlock.back")}
              </Button>
            </form>
          ) : (
            <>
              {entries.map((entry) => (
                <UnlockMethodButton
                  key={entry.id}
                  entry={entry}
                  disabled={busy}
                  onClick={() => {
                    if (entry.method === "pin") {
                      setPinEntry(entry);
                      setError("");
                    } else {
                      void handleUnlock(entry);
                    }
                  }}
                />
              ))}
              {entries.length > 0 ? (
                <p className="text-center text-body-sm text-text-subtle">
                  {t("unlock.or")}
                </p>
              ) : null}
              <Link
                href="/connect"
                className={cn(
                  buttonVariants({
                    variant: entries.length > 0 ? "outlined" : "primary",
                    size: "cta",
                  }),
                  "w-full",
                )}
              >
                {t("unlock.linkWithPhone")}
              </Link>
            </>
          )}

          <div className="mt-[4px] flex items-center justify-center gap-[8px] border-t border-border-default pt-[14px] text-body-sm text-text-muted">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="font-semibold hover:underline"
            >
              {t("unlock.contact")}
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="font-semibold hover:underline"
            >
              {t("unlock.logout")}
            </button>
          </div>
        </div>
      </AuthScreen>
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
}

function LegacyBundleNotice() {
  const t = useTranslations("chrome");
  return (
    <main className="min-h-screen flex items-center justify-center p-[32px] bg-surface">
      <div className="w-full max-w-md text-center">
        <h1 className="text-headline-md text-primary mb-[12px]">
          {t("unlock.legacyTitle")}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {t("unlock.legacyBody")}
        </p>
      </div>
    </main>
  );
}

function UnlockMethodButton({
  entry,
  disabled,
  onClick,
}: {
  entry: DeviceUnlockEntry;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("chrome");
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const probe =
      entry.method === "biometric"
        ? isPlatformAuthenticatorAvailable()
        : entry.method === "hardware-key"
          ? Promise.resolve(isWebAuthnSupported())
          : Promise.resolve(true);
    probe.then((value) => {
      if (!cancelled) setAvailable(value);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.method]);

  const method =
    entry.method === "pin"
      ? t("unlock.methodPin")
      : entry.method === "biometric"
        ? t("unlock.methodBiometric")
        : t("unlock.methodHardwareKey");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !available}
      className="w-full rounded-sm border border-border-default bg-bg-surface p-[16px] text-left transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-60"
    >
      <span className="block text-label text-text-primary">{entry.label}</span>
      <span className="mt-[4px] block text-body-sm text-text-muted">
        {available ? method : `${method} ${t("unlock.unavailableSuffix")}`}
      </span>
    </button>
  );
}
