"use client";

import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Badge } from "@keeplas/ui";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  running: {
    label: "Running",
    className: "bg-warning-container text-on-warning-container",
  },
  validated: {
    label: "Validated",
    className: "bg-secondary-container text-on-secondary-container",
  },
  escalating: {
    label: "Escalating",
    className: "bg-error-container text-on-error-container",
  },
  triggered: {
    label: "Triggered",
    className: "bg-error text-on-error",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-surface-container-highest text-on-surface-variant",
  },
};

const METHOD_LABELS: Record<string, string> = {
  tap: "App confirmation",
  email_link: "Email confirmation",
  auto: "Auto-validated",
};

export function LifeCheckHistory() {
  const history = useQuery(api.life_check.getCycleHistory, { limit: 10 });

  if (!history || history.length === 0) return null;

  return (
    <section>
      <h2 className="font-headline font-bold text-xl text-primary mb-4">
        Check History
      </h2>

      <div className="space-y-2">
        {history.map((cycle) => {
          const statusConfig =
            STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.running;
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
                      {METHOD_LABELS[cycle.validatedBy] ?? cycle.validatedBy}
                    </p>
                  )}
                </div>
              </div>
              <Badge className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
