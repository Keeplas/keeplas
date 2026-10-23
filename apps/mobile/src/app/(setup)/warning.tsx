import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Card, IconBadge, InfoRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useFinishSetup } from "@/lib/use-finish-setup";
import { useI18n } from "@/providers/i18n-provider";

/** M09-10 Only one way back in: shown when setup ends without a backup. */
export default function OneWayWarning() {
  const router = useRouter();
  const { t } = useI18n();
  const finish = useFinishSetup();
  const [understood, setUnderstood] = useState(false);

  return (
    <Screen header={<AppHeader onBack={router.back} />}>
      <IconBadge icon="alert-triangle" tone="warning" />
      <Text variant="h1">{t("oneWay.title")}</Text>
      <Text variant="body" color="text.muted">
        {t("oneWay.body")}
      </Text>
      <Card>
        <Text variant="caption" color="text.subtle" style={styles.caps}>
          {t("oneWay.waysBack")}
        </Text>
        <InfoRow
          leading={<Icon name="phone" size={22} color="status.active" />}
          title={t("oneWay.thisPhone")}
          description={t("oneWay.screenLock")}
          trailing={<StatusChip tone="success" label={t("oneWay.active")} />}
        />
        <InfoRow
          leading={<Icon name="people" size={22} color="text.muted" />}
          title={t("oneWay.contacts")}
          description={t("oneWay.contactsNeeded", { n: 0 })}
          trailing={<StatusChip tone="danger" label={t("oneWay.missing")} />}
        />
        <InfoRow
          leading={<Icon name="document" size={22} color="text.muted" />}
          title={t("oneWay.kit")}
          description={t("oneWay.kitMissing")}
          trailing={<StatusChip tone="danger" label={t("oneWay.missing")} />}
        />
      </Card>
      <Button
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

const styles = StyleSheet.create({
  caps: { textTransform: "uppercase" },
});
