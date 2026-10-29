import { Button, Icon } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useNow } from "@/lib/use-now";

const HOUR = 3_600_000;

export interface RecoveryRequestStatus {
  /** Trust contacts who approved, of the 2 needed. */
  approved: number;
  /** End of the 72 h protection window (D3). */
  windowEndsAt: number;
}

export interface RecoveryCenterViewProps {
  /** Phone number the account is found by. */
  identifier: string;
  ready: Record<"anotherDevice" | "trustContacts" | "recoveryKit", boolean>;
  request: RecoveryRequestStatus | null;
  onCancel: () => void;
  cancelling: boolean;
}

const OPTIONS = [
  { key: "anotherDevice", icon: ICON_PATHS.phone },
  { key: "trustContacts", icon: ICON_PATHS.people },
  { key: "recoveryKit", icon: ICON_PATHS.lifebuoy },
] as const;

/**
 * W04-5 Recovery center, status only: recovery starts on the phone; the web
 * shows the ways back in and follows (or cancels) a request in progress. The
 * 6-digit codes (D4) exist only on the phone that started the request: a
 * code computed here would come from what Keeplas relays.
 */
export function RecoveryCenterView({
  identifier,
  ready,
  request,
  onCancel,
  cancelling,
}: RecoveryCenterViewProps) {
  const t = useTranslations("recoveryCenter");
  const now = useNow();
  const hoursLeft = request
    ? Math.ceil((request.windowEndsAt - now) / HOUR)
    : 0;

  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      <div className="grid items-start gap-[20px] lg:grid-cols-2">
        <Panel className="flex flex-col gap-[12px] p-[20px]">
          <h2 className="text-h3 text-text-primary">{t("account.title")}</h2>
          <div className="flex items-center gap-[12px]">
            <IconTile
              icon={ICON_PATHS.phone}
              className="bg-bg-info text-text-link"
            />
            <RowText title={t("account.identified")} description={identifier} />
          </div>
          <p className="text-body-sm text-text-muted">{t("account.note")}</p>
        </Panel>

        <Panel className="flex flex-col gap-[12px] p-[20px]">
          <h2 className="text-h3 text-text-primary">{t("options.title")}</h2>
          {OPTIONS.map((option) => (
            <div key={option.key} className="flex items-center gap-[12px]">
              <Icon
                path={option.icon}
                className="size-[22px] shrink-0 text-text-link"
              />
              <RowText
                title={t(`options.${option.key}.title`)}
                description={t(`options.${option.key}.description`)}
              />
              {ready[option.key] ? (
                <StatusChip
                  tone="neutral"
                  label={t("options.ready")}
                  dotClassName="bg-status-active"
                />
              ) : (
                <StatusChip tone="pending" label={t("options.onPhone")} />
              )}
            </div>
          ))}
        </Panel>
      </div>

      {request ? (
        <Panel className="flex flex-wrap items-center gap-[20px] border-bg-danger p-[20px]">
          <div className="flex min-w-[240px] flex-1 items-center gap-[12px]">
            <IconTile
              icon={ICON_PATHS.lifebuoy}
              size={48}
              className="bg-bg-danger text-action-danger"
            />
            <RowText
              title={t("request.title")}
              description={t("request.approved", { count: request.approved })}
            />
          </div>
          <div className="flex max-w-[260px] flex-col gap-[2px]">
            <span className="text-caption text-text-muted">
              {t("request.code")}
            </span>
            <span className="text-body-sm text-text-primary">
              {t("request.codeOnPhone")}
            </span>
          </div>
          <span className="flex items-center gap-[8px] text-body text-text-primary">
            <Icon
              path={ICON_PATHS.clock}
              className="size-[20px] text-icon-default"
            />
            {hoursLeft <= 0
              ? t("request.windowEnded")
              : hoursLeft === 1
                ? t("request.hourLeft")
                : t("request.hoursLeft", { hours: hoursLeft })}
          </span>
          <Button
            variant="danger"
            size="compact"
            onClick={onCancel}
            disabled={cancelling}
          >
            {t("request.cancel")}
          </Button>
        </Panel>
      ) : null}
    </ShellPage>
  );
}
