import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readDeviceRootKey } from "@/crypto/device-vault";
import { cloudKeyName, useSealCloudBackup } from "@/features/cloud-backup";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";

/** D7 / M07-6: Keeplas envelope + synced platform CBK, on or off together. */
export default function CloudBackup() {
  const withPin = useWithPin();
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const status = useQuery(api.cloud_backup.status);
  const seal = useSealCloudBackup();
  const disable = useAuditedMutation(api.cloud_backup.disable);
  const [busy, setBusy] = useState(false);
  const account = CloudKey.provider === "icloud" ? "Apple" : "Google";

  async function enable() {
    setBusy(true);
    try {
      const rootKey = await withPin((pin) =>
        readDeviceRootKey(viewer._id, t("backup.auth"), pin),
      );
      if (!rootKey) throw new Error(t("backup.noRootKey"));
      try {
        await seal(rootKey);
      } finally {
        rootKey.fill(0);
      }
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disable({});
      await CloudKey.remove(cloudKeyName(viewer._id));
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<NavBar title={t("backup.title")} onBack={router.back} />}
      footer={
        <Button
          label={status?.enabled ? t("backup.disable") : t("backup.enable")}
          variant={status?.enabled ? "danger" : "primary"}
          onPress={() => void (status?.enabled ? turnOff() : enable())}
          loading={busy}
        />
      }
    >
      <StatusChip
        label={status?.enabled ? t("backup.on") : t("backup.off")}
        tone={status?.enabled ? "success" : "neutral"}
      />
      <Text variant="h1">{t("backup.title")}</Text>
      <Text color="text.muted">
        {t("backup.body", {
          account,
        })}
      </Text>
      <Callout
        icon="shield-check"
        text={t("backup.protected", {
          account,
        })}
      />
    </Screen>
  );
}
