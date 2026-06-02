import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Badge, HelpHint } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

export function AccessRequestsSection() {
  const t = useTranslations("trustedContacts");
  const pendingRequests = useQuery(api.access_requests.getPendingRequests);
  const allRequests = useQuery(api.access_requests.getAccessRequests);
  const cancelEmergency = useAuditedMutation(
    api.access_requests.cancelEmergencyAccess,
  );

  const [processing, setProcessing] = useState<string | null>(null);

  if (!pendingRequests?.length && !allRequests?.length) return null;

  async function handleCancelEmergency(requestId: Id<"access_requests">) {
    setProcessing(requestId);
    try {
      await cancelEmergency({ requestId });
    } finally {
      setProcessing(null);
    }
  }

  const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending: {
      label: t("accessRequests.status.pending"),
      className: "bg-warning-container text-on-warning-container",
    },
    approved: {
      label: t("accessRequests.status.approved"),
      className: "bg-secondary-container text-on-secondary-container",
    },
    denied: {
      label: t("accessRequests.status.denied"),
      className: "bg-error-container text-on-error-container",
    },
    auto_denied: {
      label: t("accessRequests.status.autoDenied"),
      className: "bg-surface-container-highest text-on-surface-variant",
    },
    expired: {
      label: t("accessRequests.status.expired"),
      className: "bg-surface-container-highest text-on-surface-variant",
    },
    revoked: {
      label: t("accessRequests.status.revoked"),
      className: "bg-surface-container-highest text-on-surface-variant",
    },
  };

  return (
    <section className="space-y-6">
      <h2 className="text-headline-md text-primary inline-flex items-center gap-2">
        {t("accessRequests.heading")}
        <HelpHint content={t("accessRequests.help")} />
      </h2>

      {/* Pending emergency requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="space-y-3">
          {pendingRequests.map((req) => {
            const confirmations = req.contactsInitiated?.length ?? 0;
            const quorumRequired = req.quorumRequired ?? 2;
            return (
              <div
                key={req._id}
                className="bg-surface-container-low rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-headline-sm text-on-surface">
                      {t("accessRequests.initiatedTitle")}
                    </h4>
                    <p className="text-body-md text-on-surface-variant">
                      {t("accessRequests.confirmedCount", {
                        confirmations,
                        quorumRequired,
                      })}
                    </p>
                  </div>
                  <Badge className="bg-warning-container text-on-warning-container">
                    {req.quorumReached
                      ? t("accessRequests.quorumReached")
                      : t("accessRequests.status.pending")}
                  </Badge>
                </div>

                {req.quorumReached && (
                  <div className="mb-3 p-3 bg-error/5 rounded-lg">
                    <p className="text-sm text-error font-medium">
                      {t("accessRequests.unlockWindowOpen")}
                    </p>
                    {req.gracePeriodEndsAt && (
                      <p className="text-xs text-error/80 mt-1">
                        {t("accessRequests.gracePeriodEnds", {
                          date: new Date(
                            req.gracePeriodEndsAt,
                          ).toLocaleString(),
                        })}
                      </p>
                    )}
                    <button
                      onClick={() => handleCancelEmergency(req._id)}
                      disabled={processing === req._id}
                      className="mt-2 text-sm px-4 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
                    >
                      {processing === req._id
                        ? t("accessRequests.cancelling")
                        : t("accessRequests.cancelButton")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Request History */}
      {allRequests && allRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-label-md text-on-surface-variant">
            {t("accessRequests.history")}
          </h3>
          {allRequests
            .filter((r) => r.status !== "pending")
            .slice(0, 10)
            .map((req) => {
              const statusConfig =
                STATUS_LABELS[req.status] ?? STATUS_LABELS.pending;
              return (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg"
                >
                  <div>
                    <span className="text-sm font-medium text-on-surface">
                      {req.contactName}
                    </span>
                    <span className="text-xs text-on-surface-variant ml-2">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}
