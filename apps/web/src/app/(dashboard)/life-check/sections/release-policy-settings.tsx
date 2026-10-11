import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { HelpHint, toast } from "@keeplas/ui";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useTranslations } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";

const THRESHOLDS = [1, 2, 3];
const WINDOWS = [3, 7, 14];

const SELECTED_CLS =
  "flex items-center justify-center p-4 bg-secondary text-on-secondary rounded-xl shadow-lg scale-[1.03] transition-transform cursor-pointer font-headline font-bold";
const UNSELECTED_CLS =
  "flex items-center justify-center p-4 bg-surface-container-highest rounded-xl hover:scale-[1.03] transition-transform cursor-pointer font-headline font-bold text-primary";

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
    <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-headline-sm text-primary mb-1.5 flex items-center gap-2">
          {t("policy.title")}
          <HelpHint content={t("policy.help")} />
        </h3>
        <p className="text-body-md text-on-surface-variant">
          {t("policy.description")}
        </p>
      </div>

      <div>
        <p className="text-label-md text-on-surface-variant mb-2 flex items-center gap-1.5">
          {t("policy.thresholdLabel")}
          <HelpHint content={t("policy.thresholdHelp")} />
        </p>
        <div className="grid grid-cols-3 gap-3">
          {THRESHOLDS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setThreshold(n);
                void persist({ threshold: n, windowDays });
              }}
              className={threshold === n ? SELECTED_CLS : UNSELECTED_CLS}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-label-md text-on-surface-variant mb-2 flex items-center gap-1.5">
          {t("policy.windowLabel")}
          <HelpHint content={t("policy.windowHelp")} />
        </p>
        <div className="grid grid-cols-3 gap-3">
          {WINDOWS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setWindowDays(n);
                void persist({ threshold, windowDays: n });
              }}
              className={windowDays === n ? SELECTED_CLS : UNSELECTED_CLS}
            >
              {t("policy.windowDays", { count: n })}
            </button>
          ))}
        </div>
      </div>

      <p className="text-label-md text-on-surface-variant pt-1">
        {t("policy.noConfirmation")}
      </p>
    </section>
  );
}
