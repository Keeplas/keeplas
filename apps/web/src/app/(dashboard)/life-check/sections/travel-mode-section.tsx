import { useMemo } from "react";
import { DatePicker, HelpHint, Icon } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

const CALENDAR_ICON = "M3.75 9h16.5m-16.5 6.75h16.5M3.75 4.5h16.5M12 4.5v15";
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
    <section
      id="travel-mode"
      className="bg-surface-container-low rounded-sm p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-headline-sm text-primary flex items-center gap-2">
            <Icon path={CALENDAR_ICON} className="w-5 h-5 text-secondary" />
            {t("travel.title")}
            <HelpHint content={t("travel.help")} />
          </h3>
          <p className="text-body-md text-on-surface-variant mt-1">
            {t("travel.description")}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label
            htmlFor="travel-until"
            className="text-label-md text-on-surface-variant block mb-1"
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
        <button
          onClick={onToggle}
          disabled={!until}
          className="px-5 py-3 rounded-xs bg-secondary text-on-secondary text-sm font-bold cursor-pointer disabled:opacity-60"
        >
          {t("travel.enable")}
        </button>
      </div>
    </section>
  );
}
