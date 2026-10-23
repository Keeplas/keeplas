import { Button } from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { formatDate } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Countdown } from "./countdown";

/**
 * "Next check-in" card (mobile Life check): surfaces the otherwise-silent
 * inactivity counter as a live countdown, so users always know a deadline is
 * running and that only their explicit reply resets it (validateCycle → tap).
 */
export function NextCheckInCard({
  nextCheckAt,
  lastCheckAt,
  paused,
  onReset,
}: {
  nextCheckAt: number;
  lastCheckAt?: number;
  /** Server-side kill switch: the counting is frozen, so no ticking clock. */
  paused: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("lifeCheck.nextCheckIn");
  const locale = useLocale();
  return (
    <Panel className="flex flex-col gap-[16px] p-[20px]">
      <p className="text-caption text-text-muted">{t("label")}</p>
      {paused ? (
        <p className="text-body text-text-primary">{t("paused")}</p>
      ) : (
        <Countdown target={nextCheckAt} />
      )}
      <p className="text-body-sm text-text-muted">
        {lastCheckAt
          ? t("lastConfirmed", { date: formatDate(lastCheckAt, locale) })
          : t("description")}
      </p>
      <Button variant="primary" size="cta" className="w-full" onClick={onReset}>
        {t("reset")}
      </Button>
    </Panel>
  );
}
