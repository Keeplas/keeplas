import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import VaultLaptop from "../../assets/illustrations/vault-laptop.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useRestorableBackup } from "@/features/cloud-backup";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

export default function LostAccess() {
  const router = useRouter();
  const { t } = useI18n();
  const { signOut } = useSession();
  const cloud = useRestorableBackup();

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
      <ListRow
        icon="people"
        title={t("lostAccess.contacts")}
        description={t("lostAccess.contactsBody")}
        onPress={() => router.push("/contact-recovery")}
      />
      <ListRow
        icon="lifebuoy"
        title={t("lostAccess.kit")}
        description={t("lostAccess.kitBody")}
        onPress={() => router.push("/recovery-kit")}
      />
      <Callout icon="shield-check" text={t("lostAccess.note")} />
      <Button variant="text" label={t("settings.signOut")} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center", paddingVertical: 8 },
});
