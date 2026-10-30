import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, IconBadge, InfoRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/**
 * M09-2 Account secured. `users.masterKeyRotationRequired` is now set, so the
 * keys row shows it as pending and leads to the on-phone rotation.
 */
export default function Secured() {
  const router = useRouter();
  const { t } = useI18n();
  const { label = "", sessions = "0" } = useLocalSearchParams<{
    label: string;
    sessions: string;
  }>();
  const count = Number(sessions);
  const done = <Icon name="check-circle" size={22} color="status.active" />;

  return (
    <Screen header={<AppHeader />} contentStyle={styles.content}>
      <IconBadge icon="shield-check" tone="success" />
      <Text variant="h1" align="center">
        {t("secured.title")}
      </Text>
      <Text variant="body" color="text.muted" align="center">
        {t("secured.body")}
      </Text>
      <Card gap={14} style={styles.full}>
        <InfoRow
          leading={done}
          title={t("secured.deviceRemoved")}
          description={label}
        />
        <InfoRow leading={done} title={t("secured.sessionsEnded", { count })} />
        <InfoRow
          leading={<Icon name="clock" size={22} color="status.pending" />}
          title={t("secured.keysPending")}
          description={t("secured.keysPendingBody")}
        />
      </Card>
      <Callout tone="warm" icon="people" text={t("secured.note")} />
      <Button
        label={t("rotation.start")}
        style={styles.full}
        onPress={() => router.push("/rotate-keys")}
      />
      <Button
        variant="secondary"
        label={t("secured.reviewDevices")}
        style={styles.full}
        onPress={() => router.replace("/devices")}
      />
      <Button
        variant="secondary"
        label={t("common.done")}
        style={styles.full}
        onPress={() => router.replace("/home")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center" },
  full: { alignSelf: "stretch" },
});
