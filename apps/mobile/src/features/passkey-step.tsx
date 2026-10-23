import { useState } from "react";
import { Linking, Platform } from "react-native";

import { Button } from "@/components/button";
import { StateSheet } from "@/components/state-message";
import { passkeyFailure } from "@/lib/errors";
import { contactSupport } from "@/lib/support";
import { useRegisterPasskey } from "@/lib/use-register-passkey";
import { useI18n } from "@/providers/i18n-provider";
import { isDeviceSecure } from "../../modules/device-lock";

/**
 * "Create passkey" button with its two Sign-in error sheets: "Set up a screen
 * lock" (no PIN, passcode, face or fingerprint) and "Passkey not created"
 * (prompt cancelled, or a failure whose detail goes to support). Shared by
 * M01-3 and M09-7.
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
  const [sheet, setSheet] = useState<"failed" | "screenLock" | null>(null);
  // Why creation failed; null when the user closed the prompt.
  const [failure, setFailure] = useState<string | null>(null);

  async function create() {
    setSheet(null);
    if (!isDeviceSecure()) return setSheet("screenLock");
    setBusy(true);
    try {
      await registerPasskey(userId);
      onDone();
    } catch (error) {
      setFailure(passkeyFailure(error));
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
        body={t(failure ? "passkey.errorBody" : "passkey.failedBody")}
        primary={{ label: t("common.tryAgain"), onPress: create }}
        secondary={{
          label: t("common.getHelp"),
          onPress: () =>
            contactSupport(failure ? `Passkey: ${failure}` : undefined),
        }}
      />
      <StateSheet
        visible={sheet === "screenLock"}
        onDismiss={() => setSheet(null)}
        icon="face-id"
        tone="info"
        title={t("passkey.screenLockTitle")}
        body={t("passkey.screenLockBody")}
        primary={{
          label: t("common.openSettings"),
          // Android opens the screen-lock page; iOS apps can only open their own settings.
          onPress: () =>
            Platform.OS === "android"
              ? Linking.sendIntent("android.settings.SECURITY_SETTINGS")
              : Linking.openSettings(),
        }}
        secondary={{ label: t("common.notNow"), onPress: () => setSheet(null) }}
      />
    </>
  );
}
