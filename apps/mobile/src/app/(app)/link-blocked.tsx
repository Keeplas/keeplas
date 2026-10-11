import { Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import {
  Callout,
  Card,
  IconBadge,
  InfoRow,
  StatusChip,
} from "@/components/surfaces";
import { Text } from "@/components/text";
import { formatFingerprint } from "@/features/link/qr-flow";
import { contactSupport } from "@/lib/support";
import { useI18n } from "@/providers/i18n-provider";

/**
 * M09-3 QR key mismatch (blocked). The QR fingerprint is the reference (it
 * was read from the user's own screen); the key Keeplas returned differs.
 */
export default function LinkBlocked() {
  const router = useRouter();
  const { t } = useI18n();
  const { expected = "", received = "" } = useLocalSearchParams<{
    expected: string;
    received: string;
  }>();
  const home = () => router.replace("/home");

  return (
    <Screen header={<AppHeader />} contentStyle={styles.content}>
      <IconBadge icon="shield-alert" tone="danger" />
      <Text variant="h1" align="center">
        {t("blocked.title")}
      </Text>
      <Text variant="body" color="text.muted" align="center">
        {t("blocked.body")}
      </Text>
      <Card style={styles.full}>
        <Text variant="caption" color="text.subtle" style={styles.caps}>
          {t("blocked.fingerprint")}
        </Text>
        <InfoRow
          leading={<Icon name="qr" size={22} />}
          title={t("blocked.expected")}
          description={formatFingerprint(expected)}
          trailing={<StatusChip tone="success" label={t("blocked.match")} />}
        />
        <InfoRow
          leading={<Icon name="browser" size={22} color="status.revoked" />}
          title={t("blocked.received")}
          description={formatFingerprint(received)}
          trailing={<StatusChip tone="danger" label={t("blocked.different")} />}
        />
      </Card>
      <Callout tone="danger" icon="alert-circle" text={t("blocked.warning")} />
      <Button label={t("blocked.back")} onPress={home} style={styles.full} />
      <Button
        variant="secondary"
        label={t("blocked.report")}
        style={styles.full}
        onPress={() => contactSupport("PAIRING_KEY_MISMATCH")}
      />
      <Button
        variant="text"
        label={t("blocked.what")}
        onPress={() => Alert.alert(t("blocked.what"), t("blocked.whatBody"))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center" },
  full: { alignSelf: "stretch" },
  caps: { textTransform: "uppercase" },
});
