import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import NewDeviceArt from "../../../assets/illustrations/new-device.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Card, InfoRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { formatDate, formatTime, placeName } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** M08-4 New device detected: "It was me" dismisses, "It wasn't me" → M09-1. */
export default function NewDevice() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const deviceId = id as Id<"devices">;
  const device = useQuery(api.devices.list)?.find((d) => d._id === deviceId);
  const confirm = useAuditedMutation(api.devices.confirm);
  const [busy, setBusy] = useState(false);

  async function itWasMe() {
    setBusy(true);
    try {
      await confirm({ deviceId });
      router.back();
    } catch {
      Alert.alert(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const label = device?.label ?? "";
  const when = device
    ? `${formatDate(device.createdAt, language)} · ${formatTime(device.createdAt, language)}`
    : "";

  return (
    <Screen header={<AppHeader />}>
      <View style={styles.art}>
        <NewDeviceArt width={353} height={268} />
      </View>
      <Text variant="h1" align="center">
        {t("newDevice.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("newDevice.body", { device: label })}
      </Text>
      <Card gap={14}>
        {device && placeName(device, language) ? (
          <InfoRow
            leading={<Icon name="map-pin" size={22} />}
            title={placeName(device, language) ?? ""}
            description={when}
          />
        ) : (
          <InfoRow leading={<Icon name="clock" size={22} />} title={when} />
        )}
        <InfoRow
          leading={
            <Icon
              name={device?.kind === "web" ? "laptop" : "phone"}
              size={22}
            />
          }
          title={label}
        />
      </Card>
      <Button label={t("newDevice.itWasMe")} loading={busy} onPress={itWasMe} />
      <Button
        variant="secondary"
        label={t("newDevice.notMe")}
        onPress={() =>
          router.replace({ pathname: "/not-me", params: { id, label, when } })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
});
