import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon, Loader, Spinner, useConfirm } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";
import { DeviceUnlockEntry } from "@/lib/device-unlock";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { useMasterKey } from "@/lib/master-key-context";
import { EnrollDeviceUnlockDialog } from "@/components/enroll-device-unlock-dialog";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

/**
 * PIN unlock entries of this browser. `onChange`
 * tells the page, which shows the PIN toggle from the same storage.
 */
export function DeviceUnlockManager({ onChange }: { onChange: () => void }) {
  const t = useTranslations("settingsSecurity");
  const user = useQuery(api.users.viewer);
  const { masterKey } = useMasterKey();
  const { entries, loading, remove, refresh } = useDeviceUnlock(user);
  const confirm = useConfirm();
  const [showEnroll, setShowEnroll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user === undefined || loading) {
    return (
      <section className="rounded-[16px] border border-border-default bg-bg-surface p-[20px]">
        <Loader label={t("deviceUnlock.loading")} />
      </section>
    );
  }

  async function handleRemove(entry: DeviceUnlockEntry) {
    const last = entries.length === 1;
    const ok = await confirm({
      title: last
        ? t("deviceUnlock.removeLastTitle")
        : t("deviceUnlock.removeTitle", { label: entry.label }),
      description: last ? t("deviceUnlock.removeLastDescription") : undefined,
      confirmLabel: t("deviceUnlock.removeConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(entry.id);
    setError(null);
    try {
      await remove(entry.id);
      onChange();
    } catch (err) {
      setError(getErrorMessage(err, t("deviceUnlock.removeError")));
    } finally {
      setBusyId(null);
    }
  }

  const canEnroll = !!masterKey;

  return (
    <section className="flex flex-col gap-[16px] rounded-[16px] border border-border-default bg-bg-surface p-[20px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 text-text-primary">
            {t("deviceUnlock.title")}
          </h2>
          <p className="mt-[2px] text-body-sm text-text-muted">
            {t("deviceUnlock.subtitle")}
          </p>
        </div>
        <Icon
          path={ICON_PATHS.lock}
          className="w-7 h-7 text-secondary shrink-0"
        />
      </div>

      {error ? (
        <div className="bg-error-container/40 p-3 rounded-xs">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      ) : null}

      {!canEnroll ? (
        <div className="bg-error-container/30 p-4 rounded-xs">
          <p className="text-body-md text-on-error-container">
            {t("deviceUnlock.locked")}
          </p>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/40 rounded-xs p-6 text-center">
          <Icon
            path={ICON_PATHS.lock}
            className="w-10 h-10 mx-auto mb-3 text-outline-variant"
          />
          <p className="text-body-md text-on-surface-variant">
            {t("deviceUnlock.empty")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const removing = busyId === entry.id;
            const subtitle = t("deviceUnlock.subtitlePin", {
              label: t("deviceUnlock.method.pin"),
              time: formatTimeAgo(entry.createdAt),
            });
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 p-3.5 bg-surface-container-lowest rounded-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xs bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                    <Icon path={ICON_PATHS.lock} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-md font-bold text-primary truncate">
                      {entry.label}
                    </p>
                    <p className="text-body-md text-on-surface-variant truncate">
                      {subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry)}
                  disabled={busyId !== null}
                  className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40 shrink-0"
                  aria-label={t("deviceUnlock.removeAria", {
                    label: entry.label,
                  })}
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
      )}

      <Button
        type="button"
        variant="vault"
        size="md"
        onClick={() => setShowEnroll(true)}
        disabled={!canEnroll}
        className="w-full justify-center gap-2"
      >
        <Icon path={ICON_PATHS.plus} className="w-4 h-4" />
        <span>{t("deviceUnlock.addMethod")}</span>
      </Button>

      <div className="flex items-start gap-3 bg-surface-container/40 p-4 rounded-xs">
        <Icon
          path={ICON_PATHS.warning}
          className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5"
        />
        <p className="text-body-md text-on-surface-variant">
          {t("deviceUnlock.footer")}
        </p>
      </div>

      {showEnroll && user && masterKey ? (
        <EnrollDeviceUnlockDialog
          user={user}
          onClose={() => {
            setShowEnroll(false);
            void refresh();
            onChange();
          }}
        />
      ) : null}
    </section>
  );
}
