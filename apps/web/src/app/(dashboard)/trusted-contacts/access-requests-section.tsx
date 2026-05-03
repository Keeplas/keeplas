"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Badge } from "@keeplas/ui";

export function AccessRequestsSection() {
  const pendingRequests = useQuery(api.access_requests.getPendingRequests);
  const allRequests = useQuery(api.access_requests.getAccessRequests);
  const cancelEmergency = useAuditedMutation(
    api.access_requests.cancelEmergencyAccess
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
      label: "Pending",
      className: "bg-warning-container text-on-warning-container",
    },
    approved: {
      label: "Approved",
      className: "bg-secondary-container text-on-secondary-container",
    },
    denied: {
      label: "Denied",
      className: "bg-error-container text-on-error-container",
    },
    auto_denied: {
      label: "Auto-denied",
      className: "bg-surface-container-highest text-on-surface-variant",
    },
    expired: {
      label: "Expired",
      className: "bg-surface-container-highest text-on-surface-variant",
    },
    revoked: {
      label: "Revoked",
      className: "bg-surface-container-highest text-on-surface-variant",
    },
  };

  return (
    <section className="space-y-6">
      <h2 className="text-headline-md text-primary">Emergency Access</h2>

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
                      Emergency Access initiated
                    </h4>
                    <p className="text-body-md text-on-surface-variant">
                      {confirmations} of {quorumRequired} contacts have
                      confirmed you are unreachable.
                    </p>
                  </div>
                  <Badge className="bg-warning-container text-on-warning-container">
                    {req.quorumReached ? "Quorum reached" : "Pending"}
                  </Badge>
                </div>

                {req.quorumReached && (
                  <div className="mb-3 p-3 bg-error/5 rounded-lg">
                    <p className="text-sm text-error font-medium">
                      Vault unlock window is open. Cancel now if you are well.
                    </p>
                    {req.gracePeriodEndsAt && (
                      <p className="text-xs text-error/80 mt-1">
                        Grace period ends:{" "}
                        {new Date(req.gracePeriodEndsAt).toLocaleString()}
                      </p>
                    )}
                    <button
                      onClick={() => handleCancelEmergency(req._id)}
                      disabled={processing === req._id}
                      className="mt-2 text-sm px-4 py-2 rounded-lg bg-error text-on-error font-medium cursor-pointer disabled:opacity-60"
                    >
                      {processing === req._id
                        ? "Cancelling..."
                        : "I am well — cancel emergency access"}
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
          <h3 className="text-label-md text-on-surface-variant">History</h3>
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
