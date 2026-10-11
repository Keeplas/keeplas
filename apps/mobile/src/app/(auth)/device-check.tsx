import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { IconBadge } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { contactSupport } from "@/lib/support";
import { useTheme } from "@/providers/theme-provider";

/** M09-9 Device check failed (App Attest / Play Integrity refused). */
export default function DeviceCheckFailed() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { ref = "" } = useLocalSearchParams<{ ref: string }>();

  return (
    <Screen header={<AppHeader />} center contentStyle={styles.content}>
      <IconBadge icon="phone" tone="neutral" />
      <Text variant="h1" align="center">
        {t("attestation.title")}
      </Text>
      <Text variant="body" color="text.muted" align="center">
        {t("attestation.body")}
      </Text>
      <View style={[styles.hint, { backgroundColor: colors["bg.subtle"] }]}>
        <Text variant="body-sm" color="text.muted">
          {t("attestation.hint")}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={t("attestation.contactSupport")}
        style={styles.full}
        onPress={() => contactSupport(ref)}
      />
      <Button
        variant="text"
        label={t("attestation.why")}
        onPress={() =>
          Alert.alert(t("attestation.why"), t("attestation.whyBody"))
        }
      />
      <Text variant="caption" color="text.subtle" align="center">
        {t("attestation.reference", { ref })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 56 },
  hint: { padding: 14, borderRadius: 12, alignSelf: "stretch" },
  full: { alignSelf: "stretch" },
});
