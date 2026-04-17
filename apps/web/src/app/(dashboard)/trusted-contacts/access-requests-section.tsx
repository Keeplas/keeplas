"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Badge } from "@keeplas/ui";

const DURATION_OPTIONS = [
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 168, label: "7 days" },
] as const;

export function AccessRequestsSection() {
  const pendingRequests = useQuery(api.access_requests.getPendingRequests);
  const allRequests = useQuery(api.access_requests.getAccessRequests);
  const approveRequest = useMutation(api.access_requests.approveRequest);
  const denyRequest = useMutation(api.access_requests.denyRequest);
  const cancelEmergency = useMutation(
    api.access_requests.cancelEmergencyAccess
  );

  const [selectedDuration, setSelectedDuration] = useState(24);
  const [processing, setProcessing] = useState<string | null>(null);

  if (!pendingRequests?.length && !allRequests?.length) return null;

  async function handleApprove(requestId: string) {
    setProcessing(requestId);
    try {
      await approveRequest({
        requestId: requestId as any,
        accessType: "read",
        durationHours: selectedDuration,
        sectionsApproved: ["all"],
      });
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeny(requestId: string) {
    setProcessing(requestId);
    try {
      await denyRequest({ requestId: requestId as any });
    } finally {
      setProcessing(null);
    }
  }

  async function handleCancelEmergency(requestId: string) {
    setProcessing(requestId);
    try {
      await cancelEmergency({ requestId: requestId as any });
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
      <h2 className="font-headline font-bold text-xl text-primary">
        Access Requests
      </h2>

      {/* Pending Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="space-y-3">
          {pendingRequests.map((req) => (
            <div
              key={req._id}
              className="bg-surface-container-low rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-headline font-bold text-on-surface">
                    {req.contactName}
                  </h4>
                  <p className="text-sm text-on-surface-variant">
                    {req.accessMode === "mode_a"
                      ? "Emergency Access (Post-mortem)"
                      : "On-demand Access"}
                  </p>
                </div>
                <Badge className="bg-warning-container text-on-warning-container">
                  Pending
                </Badge>
              </div>

              {req.reason && (
                <p className="text-sm text-on-surface-variant mb-3 bg-surface-container-lowest rounded-lg p-3">
                  &ldquo;{req.reason}&rdquo;
                </p>
              )}

              {req.accessMode === "mode_a" && req.quorumReached && (
                <div className="mb-3 p-3 bg-error/5 rounded-lg">
                  <p className="text-sm text-error font-medium">
                    Emergency access quorum reached. Grace period active.
                  </p>
                  {req.gracePeriodEndsAt && (
                    <p className="text-xs text-error/80 mt-1">
                      Expires:{" "}
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
                      : "Cancel Emergency Access"}
                  </button>
                </div>
              )}

              {req.accessMode === "mode_b1" && (
                <div className="flex items-center gap-3">
                  <select
                    value={selectedDuration}
                    onChange={(e) =>
                      setSelectedDuration(Number(e.target.value))
                    }
                    className="px-3 py-2 bg-surface-container-lowest rounded-lg text-sm text-on-surface focus:outline-none"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleApprove(req._id)}
                    disabled={processing === req._id}
                    className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => handleDeny(req._id)}
                    disabled={processing === req._id}
                    className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-sm font-medium cursor-pointer disabled:opacity-60"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request History */}
      {allRequests && allRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-label font-bold text-on-surface-variant uppercase tracking-wider">
            History
          </h3>
          {allRequests
            .filter((r) => r.status !== "pending")
            .slice(0, 10)
            .map((req) => {
              const statusConfig = STATUS_LABELS[req.status] ?? STATUS_LABELS.pending;
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
