import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { readPreference } from "@/lib/preferences";
import { useChangeLanguage } from "@/lib/use-change-language";
import { useFinishSetup } from "@/lib/use-finish-setup";
import { useI18n } from "@/providers/i18n-provider";

/** M01-6 Setup complete: optional protection, then the M09-10 check. */
export default function SetupDone() {
  const router = useRouter();
  const { t, language } = useI18n();
  const finish = useFinishSetup();
  const changeLanguage = useChangeLanguage();
  const [kitExported, setKitExported] = useState(false);

  useFocusEffect(
    useCallback(() => {
      readPreference("kitExported").then((v) => setKitExported(v === "true"));
    }, []),
  );

  return (
    <Screen header={<AppHeader />}>
      <Text variant="h1">{t("setupDone.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("setupDone.body")}
      </Text>
      <RequiredSteps completed={3} />
      <View style={styles.sectionHeader}>
        <Text variant="label">{t("setupDone.optional")}</Text>
        <Text variant="body-sm" color="text.muted">
          {`${kitExported ? 1 : 0}/2`}
        </Text>
      </View>
      <ListRow
        icon="people"
        title={t("setupDone.contactsTitle")}
        description={t("setupDone.contactsBody")}
        onPress={() => Alert.alert(t("contacts.title"), t("contacts.later"))}
      />
      <ListRow
        icon="document"
        title={t("setupDone.kitTitle")}
        description={t("setupDone.kitBody")}
        trailing={
          kitExported ? (
            <StatusChip tone="success" label={t("oneWay.active")} />
          ) : undefined
        }
        onPress={() => router.push("/kit")}
      />
      <Button
        label={t("setupDone.open")}
        chevron
        onPress={() => (kitExported ? finish() : router.push("/warning"))}
      />
      <ListRow
        icon="globe"
        title={t("common.language")}
        description={t(`languageNames.${language}`)}
        onPress={() => changeLanguage(language === "en" ? "fr" : "en")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", justifyContent: "space-between" },
});
