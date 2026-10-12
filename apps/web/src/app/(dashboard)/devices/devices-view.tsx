import type { ReactNode } from "react";
import { Button, cn, Icon, Switch } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { formatRelative } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";

export interface DeviceRow {
  id: string;
  kind: "ios" | "android" | "web";
  label: string;
  lastSeenAt: number;
  current: boolean;
}

export interface SignInAlert {
  id: string;
  label: string;
  createdAt: number;
}

export interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  tone: "active" | "pending" | "danger";
  at: number;
}

export interface DevicesViewProps {
  devices: DeviceRow[];
  alert: SignInAlert | null;
  pinEnabled: boolean;
  activity: ActivityRow[];
  onRevoke: (deviceId: string) => void;
  onNotMe: (deviceId: string) => void;
  onItWasMe: (deviceId: string) => void;
  onPinChange: (enabled: boolean) => void;
  onSeeAll?: () => void;
  /** Extra left-column content (unlock methods of this browser). */
  children?: ReactNode;
}

const TONE_DOT = {
  active: "bg-status-active",
  pending: "bg-status-pending",
  danger: "bg-action-danger",
} as const;

/** W04-6 Devices and security. */
export function DevicesView({
  devices,
  alert,
  pinEnabled,
  activity,
  onRevoke,
  onNotMe,
  onItWasMe,
  onPinChange,
  onSeeAll,
  children,
}: DevicesViewProps) {
  const t = useTranslations("devices");
  const locale = useLocale();

  const describe = (device: DeviceRow) =>
    [
      t(`kind.${device.kind}`),
      device.current
        ? t("connectedNow")
        : t("lastActive", { time: formatRelative(device.lastSeenAt, locale) }),
    ].join(" · ");

  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      <div className="grid items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-[20px]">
          <Panel className="flex flex-col gap-[16px] p-[20px]">
            <h2 className="text-h3 text-text-primary">{t("connected")}</h2>
            {devices.map((device) => (
              <div key={device.id} className="flex items-center gap-[12px]">
                <IconTile
                  icon={
                    device.kind === "web" ? ICON_PATHS.laptop : ICON_PATHS.phone
                  }
                  size={40}
                  className="bg-bg-info text-text-link"
                />
                <RowText
                  title={
                    device.current
                      ? t("current", { label: device.label })
                      : device.label
                  }
                  description={describe(device)}
                />
                {device.current ? (
                  <StatusChip
                    tone="neutral"
                    label={t("thisDevice")}
                    dotClassName="bg-status-active"
                  />
                ) : (
                  <Button
                    variant="danger"
                    size="compact"
                    onClick={() => onRevoke(device.id)}
                  >
                    {t("revoke")}
                  </Button>
                )}
              </div>
            ))}
          </Panel>
          {children}
        </div>

        <div className="flex flex-col gap-[16px]">
          {alert ? (
            <section className="flex flex-wrap items-center gap-[12px] rounded-[16px] bg-bg-danger p-[20px]">
              <Icon
                path={ICON_PATHS.alertCircle}
                className="size-[24px] shrink-0 text-action-danger"
              />
              <RowText
                title={t("alert.title")}
                description={`${alert.label} · ${formatRelative(alert.createdAt, locale)}`}
              />
              <Button
                variant="link"
                size="compact"
                onClick={() => onItWasMe(alert.id)}
              >
                {t("alert.itWasMe")}
              </Button>
              <Button
                variant="danger"
                size="compact"
                onClick={() => onNotMe(alert.id)}
              >
                {t("alert.notMe")}
              </Button>
            </section>
          ) : null}

          <Panel className="flex items-center gap-[12px] p-[20px]">
            <Icon
              path={ICON_PATHS.lock}
              className="size-[24px] shrink-0 text-text-link"
            />
            <RowText
              title={t("pin.title")}
              description={t("pin.description")}
            />
            <Switch
              checked={pinEnabled}
              onCheckedChange={onPinChange}
              aria-label={t("pin.title")}
            />
          </Panel>

          <Panel className="flex flex-col gap-[12px] p-[20px]">
            <div className="flex items-start justify-between">
              <h2 className="text-h3 text-text-primary">
                {t("activity.title")}
              </h2>
              {onSeeAll ? (
                <button
                  type="button"
                  onClick={onSeeAll}
                  className="rounded-xs text-body-sm text-text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  {t("activity.seeAll")}
                </button>
              ) : null}
            </div>
            {activity.length === 0 ? (
              <p className="text-body-sm text-text-muted">
                {t("activity.empty")}
              </p>
            ) : (
              activity.map((row) => (
                <div key={row.id} className="flex items-center gap-[12px]">
                  <span
                    className={cn(
                      "size-[10px] shrink-0 rounded-full",
                      TONE_DOT[row.tone],
                    )}
                  />
                  <RowText title={row.title} description={row.detail} />
                  <span className="shrink-0 text-body-sm text-text-muted">
                    {formatRelative(row.at, locale)}
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </ShellPage>
  );
}
