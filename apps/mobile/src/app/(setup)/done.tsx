import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { devicePinLength, PIN_LENGTH } from "@/crypto/device-vault";
import { providerName } from "@/features/cloud-backup";
import { useChangeLanguage } from "@/lib/use-change-language";
import { useFinishSetup } from "@/lib/use-finish-setup";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";

/**
 * M01-6 Setup complete: optional protection, then the M09-10 check when the
 * cloud backup could not be turned on.
 */
export default function SetupDone() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const finish = useFinishSetup();
  const changeLanguage = useChangeLanguage();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const backup = useQuery(api.cloud_backup.status);
  const invited = (contacts ?? []).length > 0;
  const backedUp = !!backup?.enabled;
  const [hasPin, setHasPin] = useState(false);

  // Re-read when coming back from the PIN screen.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void devicePinLength(viewer._id).then((length) => {
        if (alive) setHasPin(length !== null);
      });
      return () => {
        alive = false;
      };
    }, [viewer._id]),
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
          {`${Number(invited) + Number(backedUp) + Number(hasPin)}/3`}
        </Text>
      </View>
      <ListRow
        icon="people"
        title={t("setupDone.contactsTitle")}
        description={t("setupDone.contactsBody")}
        trailing={
          invited ? (
            <StatusChip tone="success" label={t("people.status.pending")} />
          ) : undefined
        }
        onPress={() => router.push("/contacts")}
      />
      <ListRow
        icon="cloud-upload"
        title={t("backup.title")}
        description={t("setupDone.backupBody", {
          account: providerName(CloudKey.provider),
        })}
        trailing={
          backedUp ? (
            <StatusChip tone="success" label={t("oneWay.active")} />
          ) : undefined
        }
        onPress={() => router.push("/backup")}
      />
      <ListRow
        icon="pin"
        title={t("privacy.pin")}
        description={t("privacy.pinBody", { n: PIN_LENGTH })}
        trailing={
          hasPin ? (
            <StatusChip tone="success" label={t("oneWay.active")} />
          ) : undefined
        }
        onPress={() => router.push("/pin-code")}
      />
      <Button
        label={t("setupDone.open")}
        chevron
        onPress={() => (backedUp ? finish() : router.push("/warning"))}
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
