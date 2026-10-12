import { Button } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { formatDate } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";

/**
 * Section 10 "Travel mode is on". Changing the dates turns travel mode off
 * and brings back the date picker; the contacts are not contacted meanwhile.
 */
export function TravelModeOnMessage({
  until,
  onChangeDates,
  onTurnOff,
}: {
  until: number | null;
  onChangeDates: () => void;
  onTurnOff: () => void;
}) {
  const t = useTranslations("lifeCheck.travelOn");
  const locale = useLocale();
  return (
    <StateMessage
      icon={ICON_PATHS.globe}
      title={t("title")}
      body={
        until ? t("bodyUntil", { date: formatDate(until, locale) }) : t("body")
      }
    >
      <Button
        variant="primary"
        size="cta"
        className="w-full"
        onClick={onChangeDates}
      >
        {t("changeDates")}
      </Button>
      <Button
        variant="link"
        className="h-[24px] px-0 text-button"
        onClick={onTurnOff}
      >
        {t("turnOff")}
      </Button>
    </StateMessage>
  );
}
