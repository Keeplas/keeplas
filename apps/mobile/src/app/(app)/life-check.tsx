import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Radio } from "@/components/controls";
import type { IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { Countdown } from "@/features/life-check/countdown";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";

const FREQUENCIES = ["weekly", "monthly", "quarterly"] as const;

const PLAN: { key: string; icon: IconName }[] = [
  { key: "reminders", icon: "bell" },
  { key: "contacts", icon: "people" },
  { key: "grace", icon: "clock" },
  { key: "assigned", icon: "document" },
];

/** M02-5 / M02-6 configuration, proactive check-in and travel mode. */
export default function LifeCheck() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { colors } = useTheme();
  const config = useQuery(api.life_check.getConfig);
  const save = useAuditedMutation(api.life_check.saveConfig);
  const validate = useAuditedMutation(api.life_check.validateCycle);
  const travel = useAuditedMutation(api.life_check.toggleTravelMode);
  const [started, setStarted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const failed = () =>
    toast({ variant: "error", title: t("common.genericError") });

  if (config === null && !started) {
    return (
      <Screen
        header={<AppHeader onBack={router.back} />}
        gap={12}
        footer={
          <Button
            label={t("succession.cta")}
            chevron
            onPress={() => setStarted(true)}
          />
        }
      >
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((dot) => (
            <View
              key={dot}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    dot === 0
                      ? colors["action.primary"]
                      : colors["border.strong"],
                },
              ]}
            />
          ))}
        </View>
        <Text variant="h1">{t("succession.title")}</Text>
        <Text variant="body-lg" color="text.muted">
          {t("succession.body")}
        </Text>
        {PLAN.map((row) => (
          <ListRow
            key={row.key}
            icon={row.icon}
            title={t(`succession.${row.key}`)}
            description={t(`succession.${row.key}Body`)}
          />
        ))}
      </Screen>
    );
  }

  async function confirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      const { nextCheckAt } = await validate({ method: "tap" });
      toast({
        variant: "success",
        title: t("lifeCheck.confirmedTitle"),
        description: nextCheckAt
          ? t("lifeCheck.confirmedBody", {
              date: formatDate(nextCheckAt, language),
            })
          : t("lifeCheck.confirmedBodyNoDate"),
      });
    } catch {
      failed();
    } finally {
      setConfirming(false);
    }
  }

  function confirmFrequency(frequency: (typeof FREQUENCIES)[number]) {
    if (config?.frequency === frequency) return;
    Alert.alert(
      t("lifeCheck.changeTitle"),
      t("lifeCheck.changeBody", { frequency: t(`frequency.${frequency}`) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("lifeCheck.changeConfirm"),
          onPress: () => void choose(frequency),
        },
      ],
    );
  }

  function toggleTravel() {
    if (config?.travelModeEnabled) {
      void travel({ enabled: false }).catch(failed);
      return;
    }
    Alert.alert(
      t("lifeCheck.travelConfirmTitle"),
      t("lifeCheck.travelConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("lifeCheck.travelConfirm"),
          onPress: () =>
            void travel({
              enabled: true,
              until: Date.now() + 30 * 86_400_000,
            }).catch(failed),
        },
      ],
    );
  }

  async function choose(frequency: (typeof FREQUENCIES)[number]) {
    try {
      await save({
        frequency,
        activeChannels: [
          { type: "push", order: 0, isEnabled: true },
          { type: "whatsapp", order: 1, isEnabled: true },
          { type: "email", order: 2, isEnabled: true },
        ],
      });
    } catch {
      failed();
    }
  }

  return (
    <Screen
      header={<NavBar title={t("lifeCheck.title")} onBack={router.back} />}
    >
      <Text variant="h1">{t("lifeCheck.title")}</Text>
      <Text color="text.muted">{t("lifeCheck.body")}</Text>
      {config ? (
        <Card>
          <Text variant="caption" color="text.muted">
            {t("lifeCheck.nextCheckIn")}
          </Text>
          {config.paused ? (
            <Text>{t("lifeCheck.paused")}</Text>
          ) : (
            <Countdown target={config.nextCheckAt} />
          )}
          <Text variant="body-sm" color="text.muted">
            {config.lastCheckAt
              ? t("lifeCheck.lastConfirmed", {
                  date: formatDate(config.lastCheckAt, language),
                })
              : t("lifeCheck.resetBody")}
          </Text>
          <Button
            label={t("lifeCheck.reset")}
            loading={confirming}
            onPress={() => void confirm()}
          />
        </Card>
      ) : null}
      <Card>
        {FREQUENCIES.map((frequency) => (
          <Radio
            key={frequency}
            selected={config?.frequency === frequency}
            onPress={() => confirmFrequency(frequency)}
            label={t(`frequency.${frequency}`)}
          />
        ))}
      </Card>
      {config ? (
        <ListRow
          icon="map-pin"
          title={t("lifeCheck.travel")}
          description={
            config.travelModeEnabled
              ? t("lifeCheck.travelOn")
              : t("lifeCheck.travelOff")
          }
          trailing={
            <StatusChip
              label={
                config.travelModeEnabled
                  ? t("lifeCheck.travelChipOn")
                  : t("lifeCheck.travelChipOff")
              }
              tone={config.travelModeEnabled ? "success" : "neutral"}
            />
          }
          onPress={toggleTravel}
        />
      ) : null}
      <Callout icon="shield-check" text={t("lifeCheck.note")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
