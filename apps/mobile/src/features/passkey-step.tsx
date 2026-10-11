import { useState } from "react";
import { Linking } from "react-native";

import { Button } from "@/components/button";
import { StateSheet } from "@/components/state-message";
import { canUseBiometrics } from "@/crypto/device-vault";
import { useRegisterPasskey } from "@/lib/use-register-passkey";
import { useI18n } from "@/providers/i18n-provider";

/**
 * "Create passkey" button with its two Sign-in error sheets: "Turn on Face
 * ID or a fingerprint" (no biometrics enrolled) and "Passkey not created"
 * (prompt cancelled / failed). Shared by M01-3 and M09-7.
 */
export function PasskeyButton({
  userId,
  label,
  onDone,
}: {
  userId: string;
  label: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const registerPasskey = useRegisterPasskey();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"failed" | "biometrics" | null>(null);

  async function create() {
    setSheet(null);
    if (!canUseBiometrics()) return setSheet("biometrics");
    setBusy(true);
    try {
      await registerPasskey(userId);
      onDone();
    } catch {
      setSheet("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button label={label} chevron loading={busy} onPress={create} />
      {__DEV__ ? (
        <Button variant="text" label={t("passkey.devSkip")} onPress={onDone} />
      ) : null}
      <StateSheet
        visible={sheet === "failed"}
        onDismiss={() => setSheet(null)}
        icon="passkey"
        tone="danger"
        title={t("passkey.failedTitle")}
        body={t("passkey.failedBody")}
        primary={{ label: t("common.tryAgain"), onPress: create }}
        secondary={{
          label: t("common.getHelp"),
          onPress: () => Linking.openURL("mailto:support@keeplas.com"),
        }}
      />
      <StateSheet
        visible={sheet === "biometrics"}
        onDismiss={() => setSheet(null)}
        icon="face-id"
        tone="info"
        title={t("passkey.biometricsTitle")}
        body={t("passkey.biometricsBody")}
        primary={{
          label: t("common.openSettings"),
          onPress: () => Linking.openSettings(),
        }}
        secondary={{ label: t("common.notNow"), onPress: () => setSheet(null) }}
      />
    </>
  );
}
