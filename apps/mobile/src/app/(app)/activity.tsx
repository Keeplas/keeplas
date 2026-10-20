import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { countryName, formatDate, formatTime } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";

const LABELLED = new Set([
  "device.registered",
  "device.confirmed",
  "device.revoked",
  "device.not_me",
  "pairing.session.approved",
  "passkey_registered",
  "passkey_removed",
  "vault_item.created",
  "vault_item.updated",
  "vault_item.deleted",
  "folder.access_granted",
  "folder.access_revoked",
  "trusted_contact.invited",
  "trusted_contact.accepted",
  "trusted_contact.revoked",
  "recovery.request.started",
  "recovery.request.cancelled",
  "recovery.request.released",
  "life_check_user_confirmed",
  "cloud_backup.enabled",
  "cloud_backup.disabled",
]);

const DANGER = /revoked|not_me|cancelled|deleted|removed|disabled|released/;
const PENDING = /started|invited|updated/;

export default function AccountActivity() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { colors } = useTheme();
  const logs = useQuery(api.audit.listLogs, { limit: 100 });
  const shown = (logs ?? []).filter((log) => LABELLED.has(log.action));

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("privacy.activity")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("activity.subtitle")}
      </Text>
      {logs && shown.length === 0 ? (
        <Text variant="body" color="text.muted">
          {t("activity.empty")}
        </Text>
      ) : null}
      {shown.length ? (
        <Card gap={0}>
          {shown.map((log, index) => (
            <View
              key={log._id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors["border.default"],
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: DANGER.test(log.action)
                      ? colors["status.revoked"]
                      : PENDING.test(log.action)
                        ? colors["status.pending"]
                        : colors["status.active"],
                  },
                ]}
              />
              <View style={styles.flex}>
                <Text variant="label">
                  {t(`activity.actions.${log.action.replace(/\./g, "_")}`)}
                </Text>
                <Text variant="body-sm" color="text.muted">
                  {[
                    `${formatDate(log.createdAt, language)} · ${formatTime(log.createdAt, language)}`,
                    log.country ? countryName(log.country, language) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1, gap: 2 },
});
