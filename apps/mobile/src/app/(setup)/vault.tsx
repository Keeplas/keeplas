import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import VaultPhone from "../../../assets/illustrations/vault-phone.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { providerName } from "@/features/cloud-backup";
import { useCreateVault } from "@/lib/use-create-vault";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import * as CloudKey from "../../../modules/cloud-key";

/** M01-4 Create your private vault (keys generated on the phone). */
export default function VaultScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const createVault = useCreateVault();
  const [phase, setPhase] = useState<"generating" | "saving" | null>(null);
  const [failed, setFailed] = useState(false);

  async function create() {
    setFailed(false);
    try {
      await createVault(viewer._id, setPhase);
      router.replace("/pin");
    } catch {
      setFailed(true);
    } finally {
      setPhase(null);
    }
  }

  return (
    <Screen header={<AppHeader />}>
      <RequiredSteps completed={2} />
      <Text variant="h1">{t("vault.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("vault.body")}
      </Text>
      <View style={styles.art}>
        <VaultPhone width={353} height={260} />
      </View>
      {phase ? (
        <Text variant="body-sm" color="text.muted" align="center">
          {t(`vault.${phase}`)}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="body-sm" color="status.revoked" align="center">
          {t("common.genericError")}
        </Text>
      ) : null}
      <Button
        label={t("vault.cta")}
        chevron
        loading={phase !== null}
        onPress={create}
      />
      <Callout
        icon="lock"
        text={t("vault.note", { provider: providerName(CloudKey.provider) })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
});
