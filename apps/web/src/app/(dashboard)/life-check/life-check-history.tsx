import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Badge } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

const STATUS_CLASSNAMES: Record<string, string> = {
  running: "bg-warning-container text-on-warning-container",
  validated: "bg-secondary-container text-on-secondary-container",
  escalating: "bg-error-container text-on-error-container",
  triggered: "bg-error text-on-error",
  cancelled: "bg-surface-container-highest text-on-surface-variant",
};

const METHOD_KEYS = ["tap", "email_link", "auto"] as const;

export function LifeCheckHistory() {
  const t = useTranslations("lifeCheck");
  const history = useQuery(api.life_check.getCycleHistory, { limit: 10 });

  if (!history || history.length === 0) return null;

  return (
    <section>
      <h2 className="font-headline font-bold text-xl text-primary mb-4">
        {t("history.title")}
      </h2>

      <div className="space-y-2">
        {history.map((cycle) => {
          const statusClassName =
            STATUS_CLASSNAMES[cycle.status] ?? STATUS_CLASSNAMES.running;
          const statusKey =
            cycle.status in STATUS_CLASSNAMES ? cycle.status : "running";
          return (
            <div
              key={cycle._id}
              className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-on-surface">
                    {new Date(cycle.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {cycle.validatedBy && (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {(METHOD_KEYS as readonly string[]).includes(
                        cycle.validatedBy,
                      )
                        ? t(`history.method.${cycle.validatedBy}`)
                        : cycle.validatedBy}
                    </p>
                  )}
                </div>
              </div>
              <Badge className={statusClassName}>
                {t(`history.status.${statusKey}`)}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
