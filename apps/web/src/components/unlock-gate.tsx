"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Input, Label, Loader, Spinner } from "@keeplas/ui";
import { deriveRootKey } from "@keeplas/crypto/kdf";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  PIN_MIN_LENGTH,
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
} from "@/lib/device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { getErrorMessage } from "@/lib/utils";
import { AuthHeroSection } from "@/app/(auth)/components/auth-hero-section";
import { MobileBrand } from "@/app/(auth)/components/mobile-brand";
import { EnrollDeviceUnlockDialog } from "./enroll-device-unlock-dialog";

interface UnlockGateProps {
  children: React.ReactNode;
}

type Mode = "list" | "pin" | "phrase";

export function UnlockGate({ children }: UnlockGateProps) {
  const { masterKey, setMasterKey, restoring } = useMasterKey();
  const user = useQuery(api.users.viewer);
  const userEmail = user?.email ?? null;
  const {
    entries,
    loading: entriesLoading,
    unlock,
  } = useDeviceUnlock({
    userEmail,
  });

  const [mode, setMode] = useState<Mode>("list");
  const [selectedEntry, setSelectedEntry] = useState<DeviceUnlockEntry | null>(
    null,
  );
  const [pin, setPin] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);

  const bundleString = user?.encryptedKeyBundle ?? null;
  const bundle = useMemo(() => {
    if (!bundleString) return null;
    try {
      return JSON.parse(bundleString) as {
        version?: number;
        phraseSalt?: string;
        wrappingKey?: string;
        iv?: string;
        encryptedMasterKey?: string;
      };
    } catch {
      return null;
    }
  }, [bundleString]);

  // Treat any bundle that carries phrase-derived material (phraseSalt + iv +
  // encryptedMasterKey, with no plaintext wrappingKey) as needing the V2
  // unlock flow — even if the explicit `version` field is missing or stored
  // differently. The strict `version === 2` check lets V2-shaped bundles slip
  // through and leaves the user with a disabled vault.
  const isV2 = !!(
    bundle?.phraseSalt &&
    bundle.iv &&
    bundle.encryptedMasterKey &&
    !("wrappingKey" in (bundle ?? {}))
  );

  // Reset the error when switching modes, adjusting during render instead of
  // syncing in an effect.
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    setError("");
  }

  if (user === undefined) {
    return <Loader fullscreen label="Loading vault" />;
  }

  if (!user) return null;

  // No bundle yet (e.g. user mid-onboarding) — let children render
  if (!bundle || !isV2) {
    return <>{children}</>;
  }

  if (masterKey) {
    return <>{children}</>;
  }

  async function handlePinUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntry) return;
    setBusy(true);
    setError("");
    try {
      const key = await unlock(selectedEntry.id, pin);
      setMasterKey(key);
      setPin("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not unlock"));
    } finally {
      setBusy(false);
    }
  }

  async function handleWebAuthnUnlock(entry: DeviceUnlockEntry) {
    setBusy(true);
    setError("");
    try {
      const key = await unlock(entry.id);
      setMasterKey(key);
    } catch (err) {
      if (err instanceof DeviceUnlockError && err.code === "cancelled") {
        setError("Authentication cancelled");
      } else {
        setError(getErrorMessage(err, "Could not unlock"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePhraseUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (
      !bundle ||
      !bundle.phraseSalt ||
      !bundle.iv ||
      !bundle.encryptedMasterKey
    )
      return;
    const words = parseRecoveryPhrase(phrase);
    if (words.length !== 24) {
      setError("Please enter all 24 words");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const salt = base64ToUint8(bundle.phraseSalt);
      const rootKey = await deriveRootKey(words, salt);
      const iv = base64ToUint8(bundle.iv);
      const ct = base64ToUint8(bundle.encryptedMasterKey);
      const rawMaster = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        rootKey,
        ct,
      );
      const master = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(rawMaster),
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
      setMasterKey(master);
      setPhrase("");
      // After phrase unlock, prompt to enroll a device unlock if none exists
      if (entries.length === 0) {
        setEnrollOpen(true);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.name === "OperationError"
          ? "Wrong recovery phrase — vault could not be decrypted"
          : getErrorMessage(err, "Recovery phrase could not unlock the vault"),
      );
    } finally {
      setBusy(false);
    }
  }

  // Still reading the persisted key from IndexedDB — show a loader instead of
  // flashing the unlock screen for a vault that's about to restore itself.
  if (restoring) {
    return <Loader fullscreen label="Unlocking vault" />;
  }

  if (entriesLoading) {
    return <Loader fullscreen label="Checking device unlock" />;
  }

  return (
    <>
      <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
        <AuthHeroSection />

        <section className="flex-1 flex items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16 relative bg-surface md:overflow-y-auto">
          <MobileBrand />

          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <h1 className="text-headline-md text-primary mb-2">
                Unlock vault
              </h1>
              <p className="text-body-md text-on-surface-variant">
                Your vault is encrypted on this device. Choose how to unlock.
              </p>
            </div>

            {error ? (
              <div className="mb-4 p-3 bg-error-container rounded-xl text-sm text-on-error-container">
                {error}
              </div>
            ) : null}

            {mode === "list" ? (
              <div className="space-y-3">
                {entries.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant text-center py-4">
                    No device unlock set up yet on this device.
                  </p>
                ) : null}
                {entries.map((entry) => (
                  <UnlockMethodButton
                    key={entry.id}
                    entry={entry}
                    disabled={busy}
                    onClick={() => {
                      if (entry.method === "pin") {
                        setSelectedEntry(entry);
                        setMode("pin");
                      } else {
                        handleWebAuthnUnlock(entry);
                      }
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setMode("phrase")}
                  disabled={busy}
                  className="w-full p-4 rounded-xl border border-outline-variant/30 text-secondary font-bold hover:bg-surface-container-low transition-colors disabled:opacity-60"
                >
                  Use 24 recovery words
                </button>
              </div>
            ) : null}

            {mode === "pin" && selectedEntry ? (
              <form onSubmit={handlePinUnlock} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unlock-pin">{selectedEntry.label}</Label>
                  <Input
                    id="unlock-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder={`At least ${PIN_MIN_LENGTH} digits`}
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
                  {busy ? <Spinner size="sm" /> : "Unlock"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setPin("");
                  }}
                  disabled={busy}
                  className="w-full text-sm text-on-surface-variant hover:underline"
                >
                  Back
                </button>
              </form>
            ) : null}

            {mode === "phrase" ? (
              <form onSubmit={handlePhraseUnlock} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unlock-phrase">Enter your 24 words</Label>
                  <textarea
                    id="unlock-phrase"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    placeholder="word1 word2 word3 ..."
                    className="w-full min-h-[140px] p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-mono text-sm focus:outline-none focus:border-secondary"
                    required
                  />
                  <p className="text-label-md text-on-surface-variant">
                    Paste all 24 words. Case, spacing, numbers and punctuation
                    are ignored — you can paste directly from the PDF.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="vault"
                  size="md"
                  disabled={busy || !phrase.trim()}
                  className="w-full"
                >
                  {busy ? <Spinner size="sm" /> : "Unlock with recovery words"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setPhrase("");
                  }}
                  disabled={busy}
                  className="w-full text-sm text-on-surface-variant hover:underline"
                >
                  Back
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </main>
      {enrollOpen && userEmail ? (
        <EnrollDeviceUnlockDialog
          userEmail={userEmail}
          onClose={() => setEnrollOpen(false)}
        />
      ) : null}
    </>
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

  if (!available) {
    return (
      <div className="p-4 rounded-xl bg-surface-container-low text-on-surface-variant text-sm">
        {entry.label} (unavailable on this device)
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-left transition-colors disabled:opacity-60"
    >
      <div className="font-bold text-on-surface">{entry.label}</div>
      <div className="text-xs text-on-surface-variant uppercase tracking-widest mt-1">
        {entry.method === "pin"
          ? "PIN"
          : entry.method === "biometric"
            ? "Biometric"
            : "Hardware key"}
      </div>
    </button>
  );
}
