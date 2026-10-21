import { useState } from "react";
import { useRouter, type Href } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import type { IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/** M08-3 Privacy and security. */
export default function Privacy() {
  const router = useRouter();
  const { t } = useI18n();
  const [pinInfo, setPinInfo] = useState(false);
  const rows: { key: string; icon: IconName; href?: Href }[] = [
    { key: "passkey", icon: "fingerprint", href: "/passkeys" },
    { key: "pin", icon: "pin" },
    { key: "kit", icon: "lifebuoy", href: "/recovery" },
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
          onPress={() => (row.href ? router.push(row.href) : setPinInfo(true))}
        />
      ))}
      <BottomSheet
        visible={pinInfo}
        onDismiss={() => setPinInfo(false)}
        title={t("privacy.pinSheetTitle")}
      >
        <Text variant="body" color="text.muted">
          {t("privacy.pinSheetBody")}
        </Text>
        <Button label={t("common.ok")} onPress={() => setPinInfo(false)} />
      </BottomSheet>
    </Screen>
  );
}
