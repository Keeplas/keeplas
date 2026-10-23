import { useState } from "react";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, IconBadge, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  CloudKeyMissing,
  providerName,
  useCloudRestore,
  useRestorableBackup,
} from "@/features/cloud-backup";
import { useEnsurePhoneProof } from "@/features/phone-proof";
import { useI18n } from "@/providers/i18n-provider";
import * as CloudKey from "../../modules/cloud-key";

/**
 * New phone, vault backed up (D7): restore it in one step. The synced key
 * comes back with the Apple / Google account; a WhatsApp code confirms the
 * number first. Once the vault opens, the stage gate moves on.
 */
export default function CloudRestore() {
  const router = useRouter();
  const { t } = useI18n();
  const restorable = useRestorableBackup();
  const ensurePhoneProof = useEnsurePhoneProof();
  const restore = useCloudRestore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = restorable ?? providerName(CloudKey.provider);

  async function run() {
    if (!ensurePhoneProof()) return;
    setBusy(true);
    setError(null);
    try {
      await restore();
    } catch (e) {
      setError(
        e instanceof CloudKeyMissing
          ? t("cloudRestore.noKey", { provider })
          : t("cloudRestore.failed"),
      );
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
      <IconBadge icon="sync" tone="info" />
      <Text variant="h1">{t("cloudRestore.title", { provider })}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("cloudRestore.body", { provider })}
      </Text>
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("cloudRestore.cta")}
        chevron
        loading={busy}
        disabled={!restorable}
        onPress={run}
      />
      <Note icon="whatsapp" text={t("cloudRestore.note")} />
    </Screen>
  );
}
