import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { BiometricRing } from "@/features/biometric-ring";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * M08-6 Unlock your vault: Face ID / fingerprint releases the device key
 * that unwraps the MasterKey. The optional Keeplas code is not offered yet.
 */
export default function Unlock() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { unlock } = useVault();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      await unlock(viewer._id, t("unlock.title"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [unlock, viewer._id, t]);

  useEffect(() => {
    void attempt();
    // Prompt once on arrival; later attempts are user-initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen header={<AppHeader />}>
      <Text variant="h1" align="center">
        {t("unlock.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("unlock.body")}
      </Text>
      <View style={styles.art}>
        <BiometricRing kind="fingerprint" size={188} />
      </View>
      <Button
        label={t("unlock.cta")}
        chevron
        loading={busy}
        onPress={attempt}
      />
      {failed ? (
        <Text variant="body-sm" color="status.revoked" align="center">
          {t("unlock.failed")}
        </Text>
      ) : null}
      <Button
        variant="text"
        label={t("unlock.lost")}
        onPress={() => Alert.alert(t("unlock.lost"), t("common.comingSoon"))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center", paddingVertical: 8 },
});
