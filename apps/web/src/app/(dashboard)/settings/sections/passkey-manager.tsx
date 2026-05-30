"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon, Loader, Spinner, useConfirm } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";
import {
  getPasskeyErrorMessage,
  registerPasskey,
  usePasskeySupport,
} from "@/lib/passkey";
import { useTranslations } from "@/lib/i18n";

export function PasskeyManager() {
  const t = useTranslations("settingsSecurity");
  const credentials = useQuery(api.webauthn.listMyCredentials);
  const startRegistration = useMutation(api.webauthn.startRegistration);
  const finishRegistration = useMutation(api.webauthn.finishRegistration);
  const removeCredential = useMutation(api.webauthn.removeCredential);

  const supported = usePasskeySupport();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"adding" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (credentials === undefined) {
    return (
      <section className="md:col-span-6 bg-surface-container-highest p-6 md:p-8 rounded-2xl">
        <Loader label={t("passkey.loading")} />
      </section>
    );
  }

  async function handleAdd() {
    setBusy("adding");
    setError(null);
    try {
      await registerPasskey({
        startRegistration: (args) => startRegistration(args),
        finishRegistration: (args) => finishRegistration(args),
      });
    } catch (err) {
      setError(getPasskeyErrorMessage(err, t("passkey.addError")));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(id: string) {
    const ok = await confirm({
      title: t("passkey.removeTitle"),
      description: t("passkey.removeDescription"),
      confirmLabel: t("passkey.removeConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(id);
    setError(null);
    try {
      await removeCredential({ credentialId: id as never });
    } catch (err) {
      setError(getPasskeyErrorMessage(err, t("passkey.removeError")));
    } finally {
      setBusy(null);
    }
  }

  const hasPasskeys = credentials.length > 0;

  return (
    <section className="md:col-span-6 bg-surface-container-highest p-6 md:p-8 rounded-2xl flex flex-col space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-headline-md text-primary">
            {t("passkey.title")}
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            {t("passkey.subtitle")}
          </p>
        </div>
        <Icon
          path={ICON_PATHS.face}
          className="w-7 h-7 text-secondary shrink-0"
        />
      </div>

      {!supported && (
        <div className="bg-error-container/30 p-4 rounded-xl">
          <p className="text-body-md text-on-error-container">
            {t("passkey.unsupported")}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-error-container/40 p-3 rounded-xl">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      {hasPasskeys ? (
        <ul className="space-y-3">
          {credentials.map((c) => {
            const removing = busy === c._id;
            return (
              <li
                key={c._id}
                className="flex items-center justify-between gap-3 p-3.5 bg-surface-container-lowest rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                    <Icon path={ICON_PATHS.fingerprint} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-md font-bold text-primary truncate">
                      {c.deviceName}
                    </p>
                    <p className="text-body-md text-on-surface-variant truncate">
                      {t("passkey.lastUsed", {
                        time: formatTimeAgo(c.lastUsedAt),
                      })}
                      {c.backedUp
                        ? t("passkey.synced")
                        : t("passkey.thisDeviceOnly")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(c._id)}
                  disabled={busy !== null}
                  className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40 shrink-0"
                  aria-label={t("passkey.removeAria", { name: c.deviceName })}
                >
                  {removing ? (
                    <Spinner size="sm" />
                  ) : (
                    <Icon path={ICON_PATHS.close} className="w-5 h-5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 text-center">
          <Icon
            path={ICON_PATHS.face}
            className="w-10 h-10 mx-auto mb-3 text-outline-variant"
          />
          <p className="text-body-md text-on-surface-variant">
            {t("passkey.empty")}
          </p>
        </div>
      )}

      <Button
        type="button"
        variant="vault"
        size="md"
        onClick={handleAdd}
        disabled={!supported || busy !== null}
        className="w-full justify-center gap-2"
      >
        {busy === "adding" ? (
          <Spinner size="sm" />
        ) : (
          <Icon path={ICON_PATHS.plus} className="w-4 h-4" />
        )}
        <span>
          {hasPasskeys ? t("passkey.addAnother") : t("passkey.addFirst")}
        </span>
      </Button>

      <div className="flex items-start gap-3 bg-error-container/30 p-4 rounded-xl mt-auto">
        <Icon
          path={ICON_PATHS.warning}
          className="w-5 h-5 text-error shrink-0 mt-0.5"
        />
        <p className="text-body-md text-on-error-container">
          {t("passkey.footer")}
        </p>
      </div>
    </section>
  );
}
