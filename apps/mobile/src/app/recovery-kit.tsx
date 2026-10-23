import { useState } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useRestorableBackup } from "@/features/cloud-backup";
import { isFullKit, takeRememberedKit, useKitOpen } from "@/features/kit-open";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * This phone holds no vault key for an account that has a vault (signed in
 * on a new phone, or an email account moving to the app): the 24 words open
 * the key bundle, then the key goes behind this phone's screen lock.
 */
export default function RecoveryKitEntry() {
  const router = useRouter();
  const { t } = useI18n();
  const { signOut } = useSession();
  const kitOpen = useKitOpen();
  const cloud = useRestorableBackup();
  const [words, setWords] = useState(takeRememberedKit);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function open() {
    setBusy(true);
    setInvalid(false);
    try {
      await kitOpen(words);
    } catch {
      setInvalid(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
    >
      <Text variant="h1">{t("recoveryKit.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("recoveryKit.body")}
      </Text>
      {cloud ? (
        <ListRow
          icon="sync"
          title={t("cloudRestore.title", { provider: cloud })}
          description={t("cloudRestore.option", { provider: cloud })}
          onPress={() => router.push("/cloud-restore")}
        />
      ) : null}
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
        disabled={!isFullKit(words)}
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
