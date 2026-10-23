import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout, Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { openDeviceVault } from "@/crypto/device-vault";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";
import { writePreference } from "@/lib/preferences";
import { toast } from "@/lib/toast";
import { useReplaceKit } from "@/lib/use-replace-kit";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/**
 * The optional recovery kit, asked for in Settings: new 24 words, shown
 * once (never stored on the phone or the server). They replace any previous
 * kit; the cloud backup is re-sealed for them.
 */
export default function KitScreen() {
  const withPin = useWithPin();
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const replaceKit = useReplaceKit();
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { pin, masterKey } = await withPin(async (code) => {
        const keys = await openDeviceVault(viewer._id, t("kit.auth"), code);
        keys.rootKey?.fill(0);
        return { pin: code, masterKey: keys.masterKey };
      });
      try {
        setPhrase(await replaceKit(viewer._id, masterKey, pin));
      } finally {
        masterKey.fill(0);
      }
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function saved() {
    await writePreference("kitExported", "true");
    setPhrase(null);
    router.back();
  }

  return (
    <Screen header={<NavBar title={t("kit.title")} onBack={router.back} />}>
      <Text variant="h1">{t("kit.title")}</Text>
      {phrase ? (
        <>
          <Text variant="body-lg" color="text.muted">
            {t("kit.body")}
          </Text>
          <Card style={styles.grid}>
            {phrase.map((word, index) => (
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
        <>
          <Text variant="body-lg" color="text.muted">
            {t("kit.intro")}
          </Text>
          <Callout icon="info" text={t("kit.replaces")} />
          <Button label={t("kit.create")} loading={busy} onPress={create} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 0, rowGap: 10 },
  word: { width: "50%", flexDirection: "row", gap: 8, alignItems: "baseline" },
  index: { width: 22 },
});
