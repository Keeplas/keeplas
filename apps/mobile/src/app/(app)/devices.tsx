import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readDeviceId } from "@/crypto/device-vault";
import { formatDate } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/** Devices (from M08-3): every device of the account; remove any other one. */
export default function Devices() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const devices = useQuery(api.devices.list);
  const revoke = useAuditedMutation(api.devices.revoke);
  const [thisDevice, setThisDevice] = useState<string | null>(null);

  useEffect(() => {
    readDeviceId(viewer._id).then(setThisDevice);
  }, [viewer._id]);

  function confirmRemove(device: Doc<"devices">) {
    Alert.alert(
      t("devices.removeTitle", { label: device.label }),
      t("devices.removeBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("devices.remove"),
          style: "destructive",
          onPress: () =>
            revoke({ deviceId: device._id }).catch(() =>
              Alert.alert(t("common.genericError")),
            ),
        },
      ],
    );
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("devices.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("devices.subtitle")}
      </Text>
      {devices?.map((device) => {
        const current = device._id === thisDevice;
        return (
          <ListRow
            key={device._id}
            icon={device.kind === "web" ? "laptop" : "phone"}
            title={device.label}
            description={t("devices.addedOn", {
              date: formatDate(device.createdAt, language),
            })}
            trailing={
              current ? (
                <StatusChip tone="info" label={t("devices.thisDevice")} />
              ) : undefined
            }
            onPress={current ? undefined : () => confirmRemove(device)}
          />
        );
      })}
      <Button
        variant="secondary"
        label={t("devices.linkComputer")}
        onPress={() => router.push("/scan")}
      />
    </Screen>
  );
}
