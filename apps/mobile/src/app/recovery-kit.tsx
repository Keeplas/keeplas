import { useState } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { saveDeviceVault } from "@/crypto/device-vault";
import { openKeyBundle } from "@/crypto/vault-keys";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * This phone holds no vault key for an account that has a vault (signed in
 * on a new phone, or an email account moving to the app): the 24 words open
 * the key bundle, then the key goes behind this phone's screen lock.
 */
export default function RecoveryKitEntry() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { refreshDeviceVault, signOut } = useSession();
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function open() {
    if (!viewer.encryptedKeyBundle) return;
    setBusy(true);
    setInvalid(false);
    try {
      const keys = await openKeyBundle(viewer.encryptedKeyBundle, words);
      await saveDeviceVault(viewer._id, keys, t("unlock.title"));
      keys.rootKey.fill(0);
      await adopt(keys.masterKey);
      refreshDeviceVault();
    } catch {
      setInvalid(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<AppHeader />}>
      <Text variant="h1">{t("recoveryKit.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("recoveryKit.body")}
      </Text>
      <TextField
        label={t("oneWay.kit")}
        value={words}
        onChangeText={setWords}
        placeholder={t("recoveryKit.placeholder")}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      {invalid ? (
        <Text variant="body-sm" color="status.revoked">
          {t("recoveryKit.invalid")}
        </Text>
      ) : null}
      <Button
        label={t("recoveryKit.cta")}
        chevron
        loading={busy}
        disabled={words.trim().split(/\s+/).length !== 24}
        onPress={open}
      />
      <Button
        variant="secondary"
        label={t("recoveryKit.contactsCta")}
        onPress={() => router.push("/contact-recovery")}
      />
      <Button variant="text" label={t("settings.signOut")} onPress={signOut} />
    </Screen>
  );
}
