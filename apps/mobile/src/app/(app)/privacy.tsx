import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import type { IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/** M08-3 Privacy and security. Devices is live; the rest comes in part 2. */
export default function Privacy() {
  const router = useRouter();
  const { t } = useI18n();
  const soon = (title: string) => () =>
    Alert.alert(title, t("common.comingSoon"));
  const rows: { key: string; icon: IconName; onPress?: () => void }[] = [
    { key: "passkey", icon: "fingerprint" },
    { key: "pin", icon: "pin" },
    { key: "kit", icon: "lifebuoy" },
    {
      key: "recovery",
      icon: "shield-check",
      onPress: () => router.push("/recovery"),
    },
    {
      key: "rotation",
      icon: "sync",
      onPress: () => router.push("/rotate-keys"),
    },
    { key: "devices", icon: "laptop", onPress: () => router.push("/devices") },
    { key: "activity", icon: "activity" },
  ];

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("privacy.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("privacy.subtitle")}
      </Text>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          icon={row.icon}
          title={t(`privacy.${row.key}`)}
          description={t(`privacy.${row.key}Body`)}
          onPress={row.onPress ?? soon(t(`privacy.${row.key}`))}
        />
      ))}
    </Screen>
  );
}
