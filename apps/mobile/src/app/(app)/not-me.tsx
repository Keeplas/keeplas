import { useState } from "react";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, IconBadge, InfoRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

const STEPS: { key: string; icon: IconName }[] = [
  { key: "remove", icon: "revoke" },
  { key: "sessions", icon: "globe" },
  { key: "rotate", icon: "sync" },
];

/**
 * M09-1 "It wasn't me": `devices.notMe` revokes the device, ends every
 * other session and flags a master-key rotation. (No owner-recovery request
 * exists yet, so the "cancel recovery" step is not listed.)
 */
export default function NotMe() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    id = "",
    label = "",
    when = "",
  } = useLocalSearchParams<{
    id: string;
    label: string;
    when: string;
  }>();
  const deviceId = id as Id<"devices">;
  const notMe = useAuditedMutation(api.devices.notMe);
  const confirm = useAuditedMutation(api.devices.confirm);
  const [busy, setBusy] = useState(false);

  async function secure() {
    setBusy(true);
    try {
      const result = (await notMe({ deviceId })) as {
        deviceLabel: string;
        sessionsEnded: number;
      };
      router.replace({
        pathname: "/secured",
        params: {
          label: result.deviceLabel,
          sessions: String(result.sessionsEnded),
        },
      });
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function itWasMe() {
    await confirm({ deviceId }).catch(() => undefined);
    router.back();
  }

  return (
    <Screen
      header={<AppHeader onBack={router.back} />}
      contentStyle={styles.content}
    >
      <IconBadge icon="shield-alert" tone="danger" />
      <Text variant="h1" align="center">
        {t("notMe.title")}
      </Text>
      <Text variant="body" color="text.muted" align="center">
        {t("notMe.body", { device: label, time: when })}
      </Text>
      <Card gap={14} style={styles.full}>
        {STEPS.map((step) => (
          <InfoRow
            key={step.key}
            leading={
              <Icon
                name={step.icon}
                size={22}
                color={
                  step.key === "remove" ? "status.revoked" : "text.primary"
                }
              />
            }
            title={t(`notMe.${step.key}`)}
            description={t(`notMe.${step.key}Body`)}
          />
        ))}
      </Card>
      <Callout icon="shield-check" text={t("notMe.note")} />
      <Button
        variant="danger"
        label={t("notMe.secure")}
        loading={busy}
        onPress={secure}
        style={styles.full}
      />
      <Button variant="text" label={t("notMe.itWasMe")} onPress={itWasMe} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center" },
  full: { alignSelf: "stretch" },
});
