import { HelpHint, Icon } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { FREQUENCIES, type Frequency } from "./constants";

const CLOCK_ICON = "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";

interface FrequencySelectorProps {
  value: Frequency;
  onChange: (value: Frequency) => void;
}

export function FrequencySelector({ value, onChange }: FrequencySelectorProps) {
  const t = useTranslations("lifeCheck");
  return (
    <section className="bg-surface-container-low rounded-2xl p-6 relative overflow-hidden">
      <h3 className="text-headline-sm text-primary mb-1.5 flex items-center gap-2">
        <Icon path={CLOCK_ICON} className="w-5 h-5 text-secondary" />
        {t("frequency.title")}
        <HelpHint content={t("frequency.help")} />
      </h3>
      <p className="text-body-md text-on-surface-variant mb-6">
        {t("frequency.description")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FREQUENCIES.map((freq) => {
          const selected = value === freq.value;
          return (
            <button
              key={freq.value}
              onClick={() => onChange(freq.value)}
              className={
                selected
                  ? "flex flex-col items-center justify-center p-5 bg-secondary text-on-secondary rounded-xl shadow-lg scale-[1.03] transition-transform cursor-pointer"
                  : "flex flex-col items-center justify-center p-5 bg-surface-container-highest rounded-xl hover:scale-[1.03] transition-transform cursor-pointer group"
              }
            >
              <span
                className={`text-headline-md font-black ${
                  selected ? "" : "text-primary group-hover:text-secondary"
                }`}
              >
                {freq.label}
              </span>
              <span
                className={`text-label-md mt-1 ${
                  selected ? "opacity-80" : "text-on-surface-variant"
                }`}
              >
                {t(`frequency.unit.${freq.value}`)}
              </span>
              <span
                className={`text-label-md mt-1 ${
                  selected ? "opacity-60" : "text-on-surface-variant/60"
                }`}
              >
                {t(`frequency.tag.${freq.value}`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
