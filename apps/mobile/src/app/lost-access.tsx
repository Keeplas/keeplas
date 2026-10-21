import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import VaultLaptop from "../../assets/illustrations/vault-laptop.svg";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

export default function LostAccess() {
  const router = useRouter();
  const { t } = useI18n();

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center", paddingVertical: 8 },
});
