import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, HelpHint, InfoCallout } from "@keeplas/ui";
import { IconTile, Panel, RowText, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import type { ChipStyle } from "./contact-display";

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

  const STATUS_LABELS: Record<string, ChipStyle & { label: string }> = {
    pending: {
      label: t("accessRequests.status.pending"),
      tone: "pending",
      dot: "bg-status-pending",
    },
    approved: {
      label: t("accessRequests.status.approved"),
      tone: "neutral",
      dot: "bg-status-active",
    },
    denied: {
      label: t("accessRequests.status.denied"),
      tone: "neutral",
      dot: "bg-action-danger",
    },
    auto_denied: {
      label: t("accessRequests.status.autoDenied"),
      tone: "neutral",
    },
    expired: { label: t("accessRequests.status.expired"), tone: "neutral" },
    revoked: { label: t("accessRequests.status.revoked"), tone: "neutral" },
  };

  return (
    <section className="flex flex-col gap-[12px]">
      <h2 className="flex items-center gap-[6px] text-h3 text-text-primary">
        {t("accessRequests.heading")}
        <HelpHint content={t("accessRequests.help")} />
      </h2>

      {/* Pending emergency requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="flex flex-col gap-[12px]">
          {pendingRequests.map((req) => {
            const confirmations = req.contactsInitiated?.length ?? 0;
            const quorumRequired = req.quorumRequired ?? 2;
            return (
              <Panel
                key={req._id}
                className="flex flex-col gap-[12px] p-[20px]"
              >
                <div className="flex items-center gap-[12px]">
                  <IconTile
                    icon={ICON_PATHS.lifebuoy}
                    className="bg-bg-danger text-action-danger"
                  />
                  <RowText
                    title={t("accessRequests.initiatedTitle")}
                    description={t("accessRequests.confirmedCount", {
                      confirmations,
                      quorumRequired,
                    })}
                  />
                  <StatusChip
                    tone="pending"
                    dotClassName="bg-status-pending"
                    label={
                      req.quorumReached
                        ? t("accessRequests.quorumReached")
                        : t("accessRequests.status.pending")
                    }
                  />
                </div>

                {req.quorumReached && (
                  <InfoCallout icon={ICON_PATHS.alertCircle} tone="danger">
                    <p className="text-label text-text-primary">
                      {t("accessRequests.unlockWindowOpen")}
                    </p>
                    {req.gracePeriodEndsAt && (
                      <p>
                        {t("accessRequests.gracePeriodEnds", {
                          date: new Date(
                            req.gracePeriodEndsAt,
                          ).toLocaleString(),
                        })}
                      </p>
                    )}
                    <Button
                      variant="danger"
                      size="compact"
                      onClick={() => handleCancelEmergency(req._id)}
                      disabled={processing === req._id}
                      className="mt-[4px]"
                    >
                      {processing === req._id
                        ? t("accessRequests.cancelling")
                        : t("accessRequests.cancelButton")}
                    </Button>
                  </InfoCallout>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* Request History */}
      {allRequests && allRequests.length > 0 && (
        <Panel className="flex flex-col px-[20px] py-[8px]">
          <h3 className="pt-[12px] text-label text-text-primary">
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
                  className="flex items-center gap-[12px] border-b border-border-default py-[12px] last:border-b-0"
                >
                  <RowText
                    title={req.contactName}
                    description={new Date(req.createdAt).toLocaleDateString()}
                  />
                  <StatusChip
                    tone={statusConfig.tone}
                    label={statusConfig.label}
                    dotClassName={statusConfig.dot}
                  />
                </div>
              );
            })}
        </Panel>
      )}
    </section>
  );
}
