import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { NavBar } from "@/components/nav-bar";
import { Radio } from "@/components/controls";
import { Screen } from "@/components/screen";
import { Callout, Card, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

const FREQUENCIES = ["weekly", "monthly", "quarterly"] as const;

/** M02-5 / M02-6 configuration, proactive check-in and travel mode. */
export default function LifeCheck() {
  const router = useRouter();
  const { t } = useI18n();
  const config = useQuery(api.life_check.getConfig);
  const save = useAuditedMutation(api.life_check.saveConfig);
  const validate = useAuditedMutation(api.life_check.validateCycle);
  const travel = useAuditedMutation(api.life_check.toggleTravelMode);

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
      Alert.alert(t("common.genericError"));
    }
  }

  return (
    <Screen
      header={<NavBar title={t("lifeCheck.title")} onBack={router.back} />}
    >
      <Text variant="h1">{t("lifeCheck.title")}</Text>
      <Text color="text.muted">{t("lifeCheck.body")}</Text>
      <Card>
        {FREQUENCIES.map((frequency) => (
          <Radio
            key={frequency}
            selected={config?.frequency === frequency}
            onPress={() => void choose(frequency)}
            label={t(`frequency.${frequency}`)}
          />
        ))}
      </Card>
      <ListRow
        icon="check-circle"
        title={t("lifeCheck.imOkay")}
        description={t("lifeCheck.imOkayBody")}
        onPress={() => void validate({ method: "tap" })}
      />
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
                config.travelModeEnabled ? t("common.done") : t("common.notNow")
              }
              tone={config.travelModeEnabled ? "success" : "neutral"}
            />
          }
          onPress={() =>
            void travel({
              enabled: !config.travelModeEnabled,
              until: !config.travelModeEnabled
                ? Date.now() + 30 * 86_400_000
                : undefined,
            })
          }
        />
      ) : null}
      <Callout icon="shield-check" text={t("lifeCheck.note")} />
    </Screen>
  );
}
