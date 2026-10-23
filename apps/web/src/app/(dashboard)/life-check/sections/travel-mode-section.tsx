import { useMemo } from "react";
import { Button, DatePicker, HelpHint } from "@keeplas/ui";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface TravelModeSectionProps {
  until: string;
  onUntilChange: (value: string) => void;
  onToggle: () => void;
}

function computeDateBounds() {
  const now = Date.now();
  return {
    today: new Date(now).toISOString().split("T")[0],
    maxDate: new Date(now + 180 * MS_PER_DAY).toISOString().split("T")[0],
  };
}

export function TravelModeSection({
  until,
  onUntilChange,
  onToggle,
}: TravelModeSectionProps) {
  const t = useTranslations("lifeCheck");
  const { today, maxDate } = useMemo(() => computeDateBounds(), []);

  return (
    <Panel id="travel-mode" className="flex flex-col gap-[16px] p-[20px]">
      <div className="flex items-center gap-[14px]">
        <IconTile
          icon={ICON_PATHS.mapPin}
          className="bg-bg-info text-text-link"
        />
        <RowText
          title={
            <span className="flex items-center gap-[6px]">
              {t("travel.title")}
              <HelpHint content={t("travel.help")} />
            </span>
          }
          description={t("travel.description")}
        />
        <StatusChip tone="neutral" label={t("travel.off")} />
      </div>

      <div className="flex flex-wrap items-end gap-[12px]">
        <div className="flex min-w-[220px] max-w-xs flex-1 flex-col gap-[6px]">
          <label
            htmlFor="travel-until"
            className="text-body-sm text-text-muted"
          >
            {t("travel.returnDate")}
          </label>
          <DatePicker
            id="travel-until"
            value={until}
            onChange={onUntilChange}
            min={today}
            max={maxDate}
            placeholder={t("travel.returnDatePlaceholder")}
          />
        </div>
        <Button
          variant="primary"
          size="regular"
          onClick={onToggle}
          disabled={!until}
        >
          {t("travel.enable")}
        </Button>
      </div>
    </Panel>
  );
}
