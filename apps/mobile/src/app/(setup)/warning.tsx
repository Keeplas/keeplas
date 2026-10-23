import { useState } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { Screen } from "@/components/screen";
import { IconBadge } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useRecoveryWays, WaysBackCard } from "@/features/recovery-ways";
import { useFinishSetup } from "@/lib/use-finish-setup";
import { useI18n } from "@/providers/i18n-provider";

/** M09-10 Only one way back in: shown when the cloud backup is off at the end of setup. */
export default function OneWayWarning() {
  const router = useRouter();
  const { t } = useI18n();
  const finish = useFinishSetup();
  const [understood, setUnderstood] = useState(false);
  const ways = useRecoveryWays();

  return (
    <Screen header={<AppHeader onBack={router.back} />}>
      <IconBadge icon="alert-triangle" tone="warning" />
      <Text variant="h1">{t("oneWay.title")}</Text>
      <Text variant="body" color="text.muted">
        {t("oneWay.body")}
      </Text>
      <WaysBackCard ways={ways} />
      <Button
        label={t("backup.enable")}
        onPress={() => router.push("/backup")}
      />
      <Button
        variant="secondary"
        label={t("oneWay.addContacts")}
        onPress={() => router.push("/contacts")}
      />
      <Button
        variant="secondary"
        label={t("oneWay.createKit")}
        onPress={() => router.push("/kit")}
      />
      <Checkbox
        checked={understood}
        onChange={setUnderstood}
        label={t("oneWay.understand")}
      />
      <Button
        variant="text"
        label={t("oneWay.continue")}
        disabled={!understood}
        onPress={finish}
      />
    </Screen>
  );
}
