import { HelpHint, RadioGroup, RadioGroupItem } from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { useTranslations } from "@/lib/i18n";
import { FREQUENCIES, type Frequency } from "./constants";

interface FrequencySelectorProps {
  value: Frequency;
  onChange: (value: Frequency) => void;
}

/** Check-in cadence as the mobile Life check radio card. */
export function FrequencySelector({ value, onChange }: FrequencySelectorProps) {
  const t = useTranslations("lifeCheck.frequency");
  return (
    <Panel className="flex flex-col gap-[16px] p-[20px]">
      <div className="flex flex-col gap-[4px]">
        <h2 className="flex items-center gap-[8px] text-h3 text-text-primary">
          {t("title")}
          <HelpHint content={t("help")} />
        </h2>
        <p className="text-body-sm text-text-muted">{t("description")}</p>
      </div>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as Frequency)}
        aria-label={t("title")}
      >
        {FREQUENCIES.map((freq) => (
          <div key={freq.value} className="flex items-center gap-[14px]">
            <RadioGroupItem value={freq.value} id={`frequency-${freq.value}`} />
            <label
              htmlFor={`frequency-${freq.value}`}
              className="flex flex-1 cursor-pointer flex-wrap items-baseline justify-between gap-x-[12px]"
            >
              <span className="text-body-lg text-text-primary">
                {t(`label.${freq.value}`)}
              </span>
              <span className="text-body-sm text-text-muted">
                {freq.label} {t(`unit.${freq.value}`).toLowerCase()} ·{" "}
                {t(`tag.${freq.value}`)}
              </span>
            </label>
          </div>
        ))}
      </RadioGroup>
    </Panel>
  );
}
