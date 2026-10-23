import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { HelpHint, RadioGroup, RadioGroupItem, toast } from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useTranslations } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

const THRESHOLDS = [1, 2, 3];
const WINDOWS = [3, 7, 14];

/** A labelled row of numeric radio options (threshold, window). */
function NumberChoice({
  name,
  label,
  help,
  options,
  value,
  format,
  onChange,
}: {
  name: string;
  label: string;
  help: string;
  options: number[];
  value: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-[12px]">
      <p className="flex items-center gap-[6px] text-label text-text-primary">
        {label}
        <HelpHint content={help} />
      </p>
      <RadioGroup
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
        aria-label={label}
        className="flex-row flex-wrap gap-x-[28px] gap-y-[12px]"
      >
        {options.map((n) => (
          <div key={n} className="flex items-center gap-[10px]">
            <RadioGroupItem value={String(n)} id={`${name}-${n}`} />
            <label
              htmlFor={`${name}-${n}`}
              className="cursor-pointer text-body text-text-primary"
            >
              {format(n)}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

/**
 * Stage-2 release policy editor: how many trusted contacts must confirm
 * unavailability and how long they have. If none do, nothing is released —
 * there is no "release anyway" option (v2 F5). Auto-saves each change (mirrors
 * the cadence selector's pattern).
 */
export function ReleasePolicySettings() {
  const t = useTranslations("lifeCheck");
  const config = useQuery(api.life_check.getConfig);
  const save = useAuditedMutation(api.life_check.saveReleasePolicy);

  const [threshold, setThreshold] = useState(2);
  const [windowDays, setWindowDays] = useState(7);

  // Seed the editable form from the server config the first time it resolves
  // (and again if it changes), without an effect. Tracking the seeded source
  // and adjusting during render is the React-blessed alternative to a
  // setState-in-effect sync.
  const [seededFrom, setSeededFrom] = useState(config);
  if (config && config !== seededFrom) {
    setSeededFrom(config);
    setThreshold(config.confirmationThreshold ?? 2);
    setWindowDays(config.confirmationWindowDays ?? 7);
  }

  if (config === null) return null;

  async function persist(values: { threshold: number; windowDays: number }) {
    try {
      await save({
        confirmationThreshold: values.threshold,
        confirmationWindowDays: values.windowDays,
      });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("policy.saveError")),
      });
    }
  }

  return (
    <Panel className="flex flex-col gap-[20px] p-[20px]">
      <div className="flex flex-col gap-[4px]">
        <h2 className="flex items-center gap-[8px] text-h3 text-text-primary">
          {t("policy.title")}
          <HelpHint content={t("policy.help")} />
        </h2>
        <p className="text-body-sm text-text-muted">
          {t("policy.description")}
        </p>
      </div>

      <NumberChoice
        name="threshold"
        label={t("policy.thresholdLabel")}
        help={t("policy.thresholdHelp")}
        options={THRESHOLDS}
        value={threshold}
        format={String}
        onChange={(n) => {
          setThreshold(n);
          void persist({ threshold: n, windowDays });
        }}
      />

      <NumberChoice
        name="window"
        label={t("policy.windowLabel")}
        help={t("policy.windowHelp")}
        options={WINDOWS}
        value={windowDays}
        format={(n) => t("policy.windowDays", { count: n })}
        onChange={(n) => {
          setWindowDays(n);
          void persist({ threshold, windowDays: n });
        }}
      />

      <p className="text-body-sm text-text-muted">
        {t("policy.noConfirmation")}
      </p>
    </Panel>
  );
}
