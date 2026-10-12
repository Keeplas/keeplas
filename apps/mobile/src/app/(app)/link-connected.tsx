import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import BrowserLinked from "../../../assets/illustrations/browser-linked.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/** M03-6 Browser connected. */
export default function LinkConnected() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    device = "",
    location = "",
    time = "",
  } = useLocalSearchParams<{
    device: string;
    location: string;
    time: string;
  }>();

  return (
    <Screen header={<AppHeader onBack={() => router.replace("/home")} />}>
      <View style={styles.art}>
        <BrowserLinked width={353} height={190} />
      </View>
      <Text variant="h1" align="center">
        {t("connected.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("connected.body")}
      </Text>
      <ListRow
        icon="globe"
        title={device}
        description={`${location} · ${time}`}
      />
      <Callout icon="bell" text={t("connected.notified")} />
      <ListRow
        icon="settings"
        title={t("connected.manage")}
        description={t("connected.manageBody")}
        onPress={() => router.replace("/devices")}
      />
      <Button
        label={t("common.done")}
        onPress={() => router.replace("/home")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
});
