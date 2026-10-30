import { useState } from "react";
import { Platform } from "react-native";

import { Button } from "@/components/button";
import { StateSheet } from "@/components/state-message";
import { useScreenLock } from "@/features/screen-lock";
import { isPasskeyUnavailable, passkeyFailure } from "@/lib/errors";
import { contactSupport } from "@/lib/support";
import { useRegisterPasskey } from "@/lib/use-register-passkey";
import { useI18n } from "@/providers/i18n-provider";

/** How to turn on this platform's passkey provider (never the other one's). */
const PROVIDER_OFF =
  Platform.OS === "ios" ? "passkey.keychainOff" : "passkey.passwordManagerOff";

/**
 * "Create passkey" button with its two Sign-in error sheets: "Set up a screen
 * lock" (no PIN, passcode, face or fingerprint) and "Passkey not created"
 * (prompt cancelled, passkeys off on this phone, or a failure whose detail
 * goes to support). Shared by M01-3 and M09-7.
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
  const screenLock = useScreenLock();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Why creation failed: the sheet's body, and the detail for support (null
  // when the user closed the prompt).
  const [failure, setFailure] = useState<{
    body: string;
    detail: string | null;
  }>({ body: "passkey.failedBody", detail: null });

  async function create() {
    setFailed(false);
    if (!screenLock.ensure()) return;
    setBusy(true);
    try {
      await registerPasskey(userId);
      onDone();
    } catch (error) {
      const detail = passkeyFailure(error);
      setFailure({
        detail,
        body: !detail
          ? "passkey.failedBody"
          : isPasskeyUnavailable(error)
            ? PROVIDER_OFF
            : "passkey.errorBody",
      });
      setFailed(true);
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
        visible={failed}
        onDismiss={() => setFailed(false)}
        icon="passkey"
        tone="danger"
        title={t("passkey.failedTitle")}
        body={t(failure.body)}
        primary={{ label: t("common.tryAgain"), onPress: create }}
        secondary={{
          label: t("common.getHelp"),
          onPress: () => {
            // The sheet is a modal: close it, or support opens underneath.
            setFailed(false);
            contactSupport(
              failure.detail ? `Passkey: ${failure.detail}` : undefined,
            );
          },
        }}
      />
      {screenLock.sheet}
    </>
  );
}
