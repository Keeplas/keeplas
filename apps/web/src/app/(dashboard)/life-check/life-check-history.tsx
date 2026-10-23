import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Panel, RowText, StatusChip } from "@/components/v2/surface";
import { formatDate } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";

// Status dot per cycle outcome (StatusChip, like the devices activity list).
const STATUS_DOTS: Record<string, string> = {
  running: "bg-status-pending",
  validated: "bg-status-active",
  escalating: "bg-status-pending",
  triggered: "bg-action-danger",
  cancelled: "bg-text-subtle",
};

const METHOD_KEYS = ["tap", "email_link", "auto"] as const;

export function LifeCheckHistory() {
  const t = useTranslations("lifeCheck");
  const locale = useLocale();
  const history = useQuery(api.life_check.getCycleHistory, { limit: 10 });

  if (!history || history.length === 0) return null;

  return (
    <Panel className="flex flex-col gap-[16px] p-[20px]">
      <h2 className="text-h3 text-text-primary">{t("history.title")}</h2>
      {history.map((cycle) => {
        const statusKey =
          cycle.status in STATUS_DOTS ? cycle.status : "running";
        return (
          <div key={cycle._id} className="flex items-center gap-[12px]">
            <RowText
              title={formatDate(cycle.startedAt, locale)}
              description={
                cycle.validatedBy
                  ? (METHOD_KEYS as readonly string[]).includes(
                      cycle.validatedBy,
                    )
                    ? t(`history.method.${cycle.validatedBy}`)
                    : cycle.validatedBy
                  : undefined
              }
            />
            <StatusChip
              tone="neutral"
              label={t(`history.status.${statusKey}`)}
              dotClassName={STATUS_DOTS[statusKey]}
            />
          </div>
        );
      })}
    </Panel>
  );
}
