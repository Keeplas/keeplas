import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { PIN_LENGTH, setDevicePin } from "@/crypto/device-vault";
import { ChoosePin, PinReasons } from "@/features/pin/choose-pin";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/** Optional setup step after the vault: a Keeplas PIN on top of the screen lock. */
export default function SetupPin() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = () => router.replace("/contacts");

  async function save(pin: string) {
    setBusy(true);
    setError(null);
    try {
      await setDevicePin(viewer._id, t("pin.auth"), undefined, pin);
      next();
    } catch {
      setError(t("pin.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<AppHeader />} gap={14}>
      <View style={styles.chip}>
        <StatusChip tone="neutral" label={t("setupPin.optional")} />
      </View>
      <Text variant="h1">{t("setupPin.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("pin.body", { n: PIN_LENGTH })}
      </Text>
      <PinReasons />
      <ChoosePin
        onChosen={(pin) => void save(pin)}
        secondary={{ label: t("contacts.skip"), onPress: next }}
        error={error}
        busy={busy}
      />
      <Text variant="body-sm" color="text.subtle" align="center">
        {t("setupPin.later")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: "flex-start" },
});
