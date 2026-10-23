import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Card, IconBadge, InfoRow, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { deviceLabel } from "@/lib/attestation";
import { formatPhone } from "@/lib/phone";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * M09-8 Password sign-in turned off. Outside the stage groups: `finalize`
 * flips the session from "migration" to "ready" while this is shown.
 */
export default function Migrated() {
  const router = useRouter();
  const { t } = useI18n();
  const { viewer } = useSession();
  const done = <Icon name="check-circle" size={22} color="status.active" />;

  return (
    <Screen header={<AppHeader />} contentStyle={styles.content}>
      <IconBadge icon="passkey" tone="success" />
      <Text variant="h1" align="center">
        {t("migration.doneTitle")}
      </Text>
      <Text variant="body" color="text.muted" align="center">
        {t("migration.doneBody")}
      </Text>
      <Card gap={14} style={styles.full}>
        <InfoRow
          leading={done}
          title={t("migration.phoneVerified")}
          description={
            viewer?.phoneNumber ? formatPhone(viewer.phoneNumber) : undefined
          }
        />
        <InfoRow
          leading={done}
          title={t("migration.passkeyCreated")}
          description={t("migration.passkeyOn", { device: deviceLabel() })}
        />
        <InfoRow
          leading={done}
          title={t("migration.appInstalled")}
          description={t("migration.appInstalledBody")}
        />
        <InfoRow
          leading={done}
          title={t("migration.passwordOff")}
          description={t("migration.passwordOffBody")}
        />
      </Card>
      <Note icon="shield-check" text={t("migration.doneNote")} />
      <Button
        label={t("migration.goToVault")}
        style={styles.full}
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center" },
  full: { alignSelf: "stretch" },
});
