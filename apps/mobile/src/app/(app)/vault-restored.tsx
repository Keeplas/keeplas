import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import VaultLaptop from "../../../assets/illustrations/vault-laptop.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Card, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

const CHECKS = ["opened", "kit", "encrypted"] as const;

export default function VaultRestored() {
  const router = useRouter();
  const { t } = useI18n();
  const health = useQuery(api.recovery.getHealth);

  return (
    <Screen
      header={<AppHeader />}
      gap={14}
      footer={
        <View style={styles.footer}>
          <Button
            label={t("vaultRestored.devices")}
            onPress={() => router.replace("/devices")}
          />
          <Button
            variant="secondary"
            label={t("vaultRestored.open")}
            onPress={() => router.replace("/home")}
          />
        </View>
      }
    >
      <Text variant="h1" align="center">
        {t("vaultRestored.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("vaultRestored.body")}
      </Text>
      <View style={styles.art}>
        <VaultLaptop width={320} height={220} />
      </View>
      <Card gap={12}>
        <View style={styles.row}>
          <Icon name="check-circle" size={22} color="accent" />
          <Text variant="label">{t("vaultRestored.cardTitle")}</Text>
        </View>
        {CHECKS.map((key) => (
          <View key={key} style={styles.row}>
            <Icon name="check" size={18} color="status.active" />
            <Text variant="body-sm" color="text.muted">
              {t(`vaultRestored.checks.${key}`)}
            </Text>
          </View>
        ))}
      </Card>
      {health?.trustContacts.renewalRequired ? (
        <ListRow
          icon="people"
          title={t("vaultRestored.renew")}
          description={t("vaultRestored.renewBody")}
          onPress={() => router.push("/recovery")}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  footer: { gap: 10 },
});
