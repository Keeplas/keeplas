import { StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import VaultLaptop from "../../assets/illustrations/vault-laptop.svg";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useRestorableBackup } from "@/features/cloud-backup";
import { OtherOptions } from "@/features/other-options";
import { useI18n } from "@/providers/i18n-provider";

export default function LostAccess() {
  const router = useRouter();
  const { t } = useI18n();
  const cloud = useRestorableBackup();
  const health = useQuery(api.recovery.getHealth);

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={12}
    >
      <Text variant="h1">{t("lostAccess.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("lostAccess.body")}
      </Text>
      <View style={styles.art}>
        <VaultLaptop width={320} height={220} />
      </View>
      {cloud ? (
        <ListRow
          icon="sync"
          title={t("cloudRestore.title", { provider: cloud })}
          description={t("cloudRestore.option", { provider: cloud })}
          onPress={() => router.push("/cloud-restore")}
        />
      ) : null}
      <ListRow
        icon="phone"
        title={t("lostAccess.device")}
        description={t("lostAccess.deviceBody")}
        onPress={() => router.push("/link-from-device")}
      />
      {health?.trustContacts.configured ? (
        <ListRow
          icon="people"
          title={t("lostAccess.contacts")}
          description={t("lostAccess.contactsBody")}
          onPress={() => router.push("/contact-recovery")}
        />
      ) : null}
      <ListRow
        icon="lifebuoy"
        title={t("lostAccess.kit")}
        description={t("lostAccess.kitBody")}
        onPress={() => router.push("/recovery-kit")}
      />
      <Callout icon="shield-check" text={t("lostAccess.note")} />
      <ListRow
        icon="help"
        title={t("help.title")}
        description={t("help.rowBody")}
        onPress={() => router.push("/help")}
      />
      <OtherOptions />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center", paddingVertical: 8 },
});
