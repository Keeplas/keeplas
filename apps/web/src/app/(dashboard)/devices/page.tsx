import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Loader, toast, useConfirm } from "@keeplas/ui";
import { EnrollDeviceUnlockDialog } from "@/components/enroll-device-unlock-dialog";
import {
  activityKey,
  activityTone,
  humanizeAction,
  isShownActivity,
  LABELLED_ACTIONS,
} from "@/lib/activity";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useSessionId } from "@/lib/session";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useDeviceUnlock } from "@/lib/use-device-unlock";
import { getErrorMessage } from "@/lib/utils";
import { DeviceUnlockManager } from "./device-unlock-manager";
import { DevicesView } from "./devices-view";

const RECENT_ACTIVITY = 3;
const LABELLED = new Set<string>(LABELLED_ACTIONS);

export default function DevicesPage() {
  const t = useTranslations("devices");
  const locale = useLocale();
  const confirm = useConfirm();
  const sessionId = useSessionId();
  const viewer = useQuery(api.users.viewer);
  const devices = useQuery(api.devices.list);
  const alerts = useQuery(api.devices.pendingAlerts);
  const logs = useQuery(api.audit.listLogs, { limit: 50 });
  const revoke = useAuditedMutation(api.devices.revoke);
  const notMe = useAuditedMutation(api.devices.notMe);
  const { entries, remove, refresh } = useDeviceUnlock(viewer);
  const [enrolling, setEnrolling] = useState(false);
  // Remounts the methods list after the PIN toggle changed the same storage.
  const [unlockVersion, setUnlockVersion] = useState(0);
  const [allActivity, setAllActivity] = useState(false);

  if (!viewer || !devices || !alerts || !logs) return <Loader />;

  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const regionName = (code: string) => regions.of(code) ?? code;
  const pinEntry = entries.find((entry) => entry.method === "pin");
  const label = (deviceId: string) =>
    devices.find((device) => device._id === deviceId)?.label ?? "";

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast({ title: done });
    } catch (err) {
      toast({ variant: "error", title: getErrorMessage(err, t("failed")) });
    }
  }

  async function handleRevoke(deviceId: string) {
    const ok = await confirm({
      title: t("revokeDialog.title", { label: label(deviceId) }),
      description: t("revokeDialog.body"),
      confirmLabel: t("revoke"),
      variant: "destructive",
    });
    if (ok) {
      await run(
        () => revoke({ deviceId: deviceId as Id<"devices"> }),
        t("revokeDialog.done"),
      );
    }
  }

  async function handleNotMe(deviceId: string) {
    const ok = await confirm({
      title: t("notMeDialog.title"),
      description: t("notMeDialog.body", { label: label(deviceId) }),
      confirmLabel: t("notMeDialog.confirm"),
      variant: "destructive",
    });
    if (ok) {
      await run(
        () => notMe({ deviceId: deviceId as Id<"devices"> }),
        t("notMeDialog.done"),
      );
    }
  }

  async function handlePin(enabled: boolean) {
    if (enabled) {
      setEnrolling(true);
      return;
    }
    if (!pinEntry) return;
    const ok = await confirm({
      title: t("pin.removeTitle"),
      description: t("pin.removeBody"),
      confirmLabel: t("pin.removeConfirm"),
      variant: "destructive",
    });
    if (ok) {
      await run(() => remove(pinEntry.id), t("pin.removed"));
      setUnlockVersion((v) => v + 1);
    }
  }

  const activity = logs
    .filter((log) => isShownActivity(log.action))
    .slice(0, allActivity ? undefined : RECENT_ACTIVITY)
    .map((log) => ({
      id: log._id,
      title: LABELLED.has(log.action)
        ? t(`activity.actions.${activityKey(log.action)}`)
        : humanizeAction(log.action),
      detail:
        log.country && log.country !== "XX" ? regionName(log.country) : "",
      tone: activityTone(log.action),
      at: log.createdAt,
    }));

  const alert = alerts[0];

  return (
    <>
      <DevicesView
        devices={devices.map((device) => ({
          id: device._id,
          kind: device.kind,
          label: device.label,
          lastSeenAt: device.lastSeenAt,
          current: !!sessionId && device.sessionId === sessionId,
        }))}
        alert={
          alert
            ? { id: alert._id, label: alert.label, createdAt: alert.createdAt }
            : null
        }
        pinEnabled={!!pinEntry}
        activity={activity}
        onRevoke={(id) => void handleRevoke(id)}
        onNotMe={(id) => void handleNotMe(id)}
        onPinChange={(enabled) => void handlePin(enabled)}
        onSeeAll={allActivity ? undefined : () => setAllActivity(true)}
      >
        <DeviceUnlockManager key={unlockVersion} onChange={refresh} />
      </DevicesView>
      {enrolling ? (
        <EnrollDeviceUnlockDialog
          user={viewer}
          onClose={() => {
            setEnrolling(false);
            void refresh();
            setUnlockVersion((v) => v + 1);
          }}
        />
      ) : null}
    </>
  );
}
