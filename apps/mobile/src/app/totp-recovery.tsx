import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  CloudKeyMissing,
  useCloudRestore,
  useRestorableBackup,
} from "@/features/cloud-backup";
import { isFullKit, takeRememberedKit, useKitOpen } from "@/features/kit-open";
import { KitWordsField } from "@/features/kit-words-field";
import { useEnsurePhoneProof } from "@/features/phone-proof";
import { useProveVault } from "@/features/vault-proof";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Lost authenticator app: open the vault on this phone (cloud backup or the
 * 24 words), prove it with the identity key, and TOTP is turned off. The
 * gate query then flips and the root layout moves on.
 */
export default function TotpRecovery() {
  const router = useRouter();
  const { t } = useI18n();
  const cloud = useRestorableBackup();
  const ensurePhoneProof = useEnsurePhoneProof();
  const cloudRestore = useCloudRestore();
  const kitOpen = useKitOpen();
  const proveVault = useProveVault();
  const reset = useMutation(api.totp.resetWithVaultProof);
  const [words, setWords] = useState(takeRememberedKit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(open: () => Promise<CryptoKey>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await proveVault(await open());
      await reset();
    } catch (e) {
      setError(
        e instanceof CloudKeyMissing
          ? t("cloudRestore.noKey", { provider: cloud ?? "" })
          : failure,
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
      <Text variant="h1">{t("totpRecovery.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("totpRecovery.body")}
      </Text>
      {cloud ? (
        <ListRow
          icon="sync"
          title={t("cloudRestore.title", { provider: cloud })}
          description={t("cloudRestore.option", { provider: cloud })}
          onPress={() => {
            if (ensurePhoneProof())
              void finish(cloudRestore, t("cloudRestore.failed"));
          }}
        />
      ) : null}
      <KitWordsField value={words} onChangeText={setWords} />
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("totpRecovery.cta")}
        chevron
        loading={busy}
        disabled={!isFullKit(words)}
        onPress={() => finish(() => kitOpen(words), t("recoveryKit.invalid"))}
      />
    </Screen>
  );
}
