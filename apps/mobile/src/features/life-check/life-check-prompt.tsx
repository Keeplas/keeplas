import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { api } from "@keeplas/backend/_generated/api";

import Branch from "../../../assets/illustrations/branch.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { TabBarVisibleContext } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

export function LifeCheckPrompt({ missed }: { missed: boolean }) {
  const { t } = useI18n();
  const validate = useAuditedMutation(api.life_check.validateCycle);
  const postpone = useAuditedMutation(api.life_check.postponeCycle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function answer(run: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await run();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <TabBarVisibleContext.Provider value={false}>
        <Screen
          header={<AppHeader />}
          decor="landscape"
          center
          footer={
            <View style={styles.footer}>
              <Button
                label={t(
                  missed
                    ? "lifeCheck.prompt.missedConfirm"
                    : "lifeCheck.prompt.confirm",
                )}
                loading={busy}
                onPress={() => void answer(() => validate({ method: "tap" }))}
              />
              {missed ? null : (
                // Outlined, not a text link: it sits over the landscape decor.
                <Button
                  variant="secondary"
                  label={t("lifeCheck.prompt.later")}
                  disabled={busy}
                  onPress={() =>
                    void answer(() => postpone({ duration: "48h" }))
                  }
                />
              )}
              <Callout
                icon="shield-check"
                text={t("lifeCheck.prompt.footer")}
              />
            </View>
          }
        >
          <Branch width={72} height={72} />
          <Text variant="h1" align="center">
            {t(
              missed
                ? "lifeCheck.prompt.missedTitle"
                : "lifeCheck.prompt.title",
            )}
          </Text>
          <Text variant="body-lg" color="text.muted" align="center">
            {t(
              missed ? "lifeCheck.prompt.missedBody" : "lifeCheck.prompt.body",
            )}
          </Text>
          <ErrorText align="center">
            {error ? t("lifeCheck.prompt.failed") : null}
          </ErrorText>
        </Screen>
      </TabBarVisibleContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12 },
});
