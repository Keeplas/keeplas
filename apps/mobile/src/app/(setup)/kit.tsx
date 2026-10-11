import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { writePreference } from "@/lib/preferences";
import { useFinishSetup } from "@/lib/use-finish-setup";
import { useI18n } from "@/providers/i18n-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * The optional recovery kit: the 24 words generated with the vault, shown
 * only during setup (they are never stored on the phone or the server).
 */
export default function KitScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { setupPhrase } = useVault();
  const finish = useFinishSetup();

  async function saved() {
    await writePreference("kitExported", "true");
    finish();
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />}>
      <Text variant="h1">{t("kit.title")}</Text>
      {setupPhrase ? (
        <>
          <Text variant="body-lg" color="text.muted">
            {t("kit.body")}
          </Text>
          <Card style={styles.grid}>
            {setupPhrase.map((word, index) => (
              <View key={index} style={styles.word}>
                <Text
                  variant="body-sm"
                  color="text.subtle"
                  style={styles.index}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text variant="label" selectable={false}>
                  {word}
                </Text>
              </View>
            ))}
          </Card>
          <Callout tone="danger" icon="alert-circle" text={t("kit.warning")} />
          <Button label={t("kit.saved")} onPress={saved} />
        </>
      ) : (
        <Callout icon="info" text={t("kit.unavailable")} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 0, rowGap: 10 },
  word: { width: "50%", flexDirection: "row", gap: 8, alignItems: "baseline" },
  index: { width: 22 },
});
