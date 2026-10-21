import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { sealCloudBackup } from "@keeplas/crypto/cloud";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readDeviceRootKey } from "@/crypto/device-vault";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";

const storageKey = (userId: string) => `keeplas.cbk.${userId}`;

/** D7 / M07-6: Keeplas envelope + synced platform CBK, on or off together. */
export default function CloudBackup() {
  const withPin = useWithPin();
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const status = useQuery(api.cloud_backup.status);
  const save = useAuditedMutation(api.cloud_backup.save);
  const disable = useAuditedMutation(api.cloud_backup.disable);
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const rootKey = await withPin((pin) =>
        readDeviceRootKey(viewer._id, t("backup.auth"), pin),
      );
      if (!rootKey) throw new Error(t("backup.noRootKey"));
      try {
        const sealed = await sealCloudBackup({ rootKey, userId: viewer._id });
        await CloudKey.write(storageKey(viewer._id), sealed.cbk);
        await save({ provider: CloudKey.provider, envelope: sealed.envelope });
      } finally {
        rootKey.fill(0);
      }
    } catch (error) {
      if (isPinAbort(error)) return;
      Alert.alert(
        t("common.genericError"),
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disable({});
      await CloudKey.remove(storageKey(viewer._id));
    } catch {
      Alert.alert(t("common.genericError"));
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
      <Text color="text.muted">{t("backup.body")}</Text>
      <Callout tone="warning" icon="alert-triangle" text={t("backup.risk")} />
    </Screen>
  );
}
