import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader, toast, useConfirm } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";
import { RecoveryCenterView } from "./recovery-center-view";

// Statuses of a request still in progress (released = waiting on the phone).
const IN_PROGRESS = new Set([
  "pending",
  "approved_1",
  "approved_2",
  "released",
]);

export default function RecoveryCenterPage() {
  const t = useTranslations("recoveryCenter");
  const confirm = useConfirm();
  const viewer = useQuery(api.users.viewer);
  const health = useQuery(api.recovery.getHealth);
  const request = useQuery(api.recovery.getMyRequest);
  const cancel = useAuditedMutation(api.recovery.cancel);
  const [cancelling, setCancelling] = useState(false);
  // No code here: only the phone that started the request can compute them.
  const active = request && IN_PROGRESS.has(request.status) ? request : null;

  if (!viewer || health === undefined || request === undefined) {
    return <Loader />;
  }

  async function handleCancel() {
    const ok = await confirm({
      title: t("cancelDialog.title"),
      description: t("cancelDialog.body"),
      confirmLabel: t("request.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await cancel();
      toast({ title: t("cancelDialog.done") });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("cancelDialog.failed")),
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <RecoveryCenterView
      identifier={viewer.phoneNumber ?? viewer.email ?? ""}
      ready={{
        anotherDevice: (health?.activeDevices ?? 0) > 1,
        trustContacts:
          !!health?.trustContacts.configured &&
          !health.trustContacts.renewalRequired,
        recoveryKit: !!health?.recoveryKit,
      }}
      request={
        active
          ? {
              approved: active.contacts.filter(
                (contact) => contact.decision === "approve",
              ).length,
              windowEndsAt: active.windowEndsAt,
            }
          : null
      }
      onCancel={() => void handleCancel()}
      cancelling={cancelling}
    />
  );
}
