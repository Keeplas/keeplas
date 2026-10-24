import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Icon, type IconName } from "@/components/icon";
import { Card, InfoRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { providerName } from "@/features/cloud-backup";
import { readPreference } from "@/lib/preferences";
import { useI18n } from "@/providers/i18n-provider";
import * as CloudKey from "../../modules/cloud-key";

/**
 * The owner's ways back into the vault after losing this phone: the cloud
 * backup, two ready trust contacts, a recovery kit. One is enough, so Home
 * and the Recovery center both show `covered`; sharing this hook keeps them
 * from disagreeing.
 */
export function useRecoveryWays() {
  const backup = useQuery(api.cloud_backup.status);
  const contacts = useQuery(api.trusted_contacts.getContactsReady) ?? false;
  const [kit, setKit] = useState(false);

  useFocusEffect(
    useCallback(() => {
      readPreference("kitExported").then((v) => setKit(v === "true"));
    }, []),
  );

  const backedUp = backup?.enabled === true;
  return {
    backup: backedUp,
    contacts,
    kit,
    /** At least one way back besides this phone. */
    covered: backedUp || contacts || kit,
  };
}

/** "Your ways back in" card: this phone, the cloud backup, contacts, a kit. */
export function WaysBackCard({
  ways,
}: {
  ways: Pick<ReturnType<typeof useRecoveryWays>, "backup" | "contacts" | "kit">;
}) {
  const { t } = useI18n();
  const status = (on: boolean, off: "missing" | "optional") => (
    <StatusChip
      tone={on ? "success" : off === "missing" ? "danger" : "neutral"}
      label={t(on ? "oneWay.active" : `waysBack.${off}`)}
    />
  );
  const icon = (name: IconName, on: boolean) => (
    <Icon name={name} size={22} color={on ? "status.active" : "text.muted"} />
  );

  return (
    <Card>
      <Text variant="caption" color="text.subtle" style={styles.caps}>
        {t("oneWay.waysBack")}
      </Text>
      <InfoRow
        leading={icon("phone", true)}
        title={t("oneWay.thisPhone")}
        description={t("oneWay.screenLock")}
        trailing={status(true, "missing")}
      />
      <InfoRow
        leading={icon("cloud-upload", ways.backup)}
        title={t("backup.title")}
        description={
          ways.backup
            ? t("setupDone.backupBody", {
                account: providerName(CloudKey.provider),
              })
            : t("oneWay.backupMissing")
        }
        trailing={status(ways.backup, "missing")}
      />
      <InfoRow
        leading={icon("people", ways.contacts)}
        title={t("oneWay.contacts")}
        description={t(
          ways.contacts ? "waysBack.contactsReady" : "waysBack.contactsNeeded",
        )}
        trailing={status(ways.contacts, "missing")}
      />
      <InfoRow
        leading={icon("lifebuoy", ways.kit)}
        title={t("oneWay.kit")}
        description={t("waysBack.kitBody")}
        trailing={status(ways.kit, "optional")}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  caps: { textTransform: "uppercase" },
});
