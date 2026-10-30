import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useRestorableBackup } from "@/features/cloud-backup";
import {
  isFullKit,
  takeRememberedKit,
  useKitOpen,
  vaultOpenErrorKey,
} from "@/features/kit-open";
import { KitWordsField } from "@/features/kit-words-field";
import { OtherOptions } from "@/features/other-options";
import { useScreenLock } from "@/features/screen-lock";
import { needsCloudBackup } from "@/lib/backup-policy";
import { useI18n } from "@/providers/i18n-provider";
import * as CloudKey from "../../modules/cloud-key";

/**
 * This phone holds no vault key for an account that has a vault (signed in
 * on a new phone, or an email account moving to the app): the 24 words open
 * the key bundle, then the key goes behind this phone's screen lock.
 */
export default function RecoveryKitEntry() {
  const router = useRouter();
  const { t } = useI18n();
  const kitOpen = useKitOpen();
  const screenLock = useScreenLock();
  const cloud = useRestorableBackup();
  const backup = useQuery(api.cloud_backup.status);
  const health = useQuery(api.recovery.getHealth);
  const [words, setWords] = useState(takeRememberedKit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState(false);

  useEffect(() => {
    CloudKey.isEndToEndEncrypted()
      .then(setEncrypted)
      .catch(() => setEncrypted(false));
  }, []);

  async function open() {
    setError(null);
    if (!screenLock.ensure()) return;
    setBusy(true);
    try {
      await kitOpen(words);
    } catch (e) {
      setError(t(vaultOpenErrorKey(e)));
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
      {encrypted && needsCloudBackup(backup) ? (
        <Callout
          icon="cloud-upload"
          text={t(
            CloudKey.provider === "icloud"
              ? "recoveryKit.lastTimeIcloud"
              : "recoveryKit.lastTimeGoogle",
          )}
        />
      ) : null}
      <KitWordsField value={words} onChangeText={setWords} />
      <ErrorText>{error}</ErrorText>
      <Button
        label={t("recoveryKit.cta")}
        chevron
        loading={busy}
        disabled={!isFullKit(words)}
        onPress={open}
      />
      <OtherOptions
        options={
          health?.trustContacts.configured
            ? [
                {
                  icon: "people",
                  title: t("recoveryKit.contactsCta"),
                  description: t("lostAccess.contactsBody"),
                  onPress: () => router.push("/contact-recovery"),
                },
              ]
            : []
        }
      />
      {screenLock.sheet}
    </Screen>
  );
}
