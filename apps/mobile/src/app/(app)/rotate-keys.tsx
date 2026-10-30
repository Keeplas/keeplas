import { useState } from "react";
import { useRouter } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateSheet } from "@/components/state-message";
import { BulletCard, Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { ContactKeyBlocked } from "@/crypto/contact-keys";
import { readDeviceRootKey, saveDeviceVault } from "@/crypto/device-vault";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import {
  LegacyItemsError,
  NoRootKeyError,
  rotateVault,
} from "@/features/vault/rotate-vault";
import { useContactTrust } from "@/features/vault/use-contact-trust";
import { useProveVault } from "@/features/vault-proof";
import { serverMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";

type Items = FunctionReturnType<typeof api.rotation.getRotatableItems>;

/**
 * On-phone key rotation (features/vault/rotate-vault.ts). Item DEKs stay;
 * every key that opens them changes. Re-running it resumes a rotation that
 * was interrupted.
 */
export default function RotateKeys() {
  const withPin = useWithPin();
  const router = useRouter();
  const convex = useConvex();
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt, masterKey } = useVault();
  const proveVault = useProveVault();
  const ensureCloudBackup = useEnsureCloudBackup();
  const rotate = useAuditedMutation(api.rotation.rotateKeyMaterial);
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const finalize = useAuditedMutation(api.rotation.finalizeRotation);
  const { pin: persistPin } = useContactTrust();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Items | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function ask() {
    setItems(null);
    setBusy(true);
    try {
      setItems(await convex.query(api.rotation.getRotatableItems));
      setConfirming(true);
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function run(items: Items) {
    setConfirming(false);
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    let rootKey: Uint8Array | null = null;
    try {
      if (!masterKey) throw new Error("Vault is locked");
      const pinned = await withPin(async (code) => ({
        pin: code,
        rootKey: await readDeviceRootKey(viewer._id, t("rotation.auth"), code),
      }));
      rootKey = pinned.rootKey;
      // Replacing the identity key needs proof of the current one.
      await proveVault(masterKey);
      const newRootKey = await rotateVault({
        user: viewer,
        masterKey,
        rootKey,
        server: {
          items: () => convex.query(api.rotation.getRotatableItems),
          recipients: (itemId) =>
            convex.query(api.rotation.getItemRecipients, { itemId }),
          contacts: () => convex.query(api.trusted_contacts.getContacts),
          categories: () => convex.query(api.vault_categories.list),
          folders: () => convex.query(api.folders.list),
          rotate,
          updateItem,
          finalize,
          pin: persistPin,
        },
        keepKeys: async (keys) => {
          await saveDeviceVault(
            viewer._id,
            keys,
            t("unlock.title"),
            pinned.pin,
          );
          await adopt(keys.masterKey);
        },
        onProgress: (done, total) => setProgress({ done, total }),
      });
      void ensureCloudBackup(newRootKey);
      router.back();
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({
        variant: "error",
        title: t("rotation.failed"),
        description:
          error instanceof ContactKeyBlocked
            ? t("rotation.contactKey", { name: error.contactName ?? "" })
            : error instanceof LegacyItemsError
              ? t("rotation.legacy")
              : error instanceof NoRootKeyError
                ? t("rotation.noRoot")
                : serverMessage(error),
      });
    } finally {
      rootKey?.fill(0);
      setBusy(false);
    }
  }

  const { done } = progress;
  const total = busy ? progress.total : (items?.length ?? 0);
  const shared = contacts?.length ?? 0;

  return (
    <Screen
      header={<NavBar title={t("rotation.title")} onBack={router.back} />}
      footer={
        busy && items ? null : (
          <Button
            label={t("rotation.start")}
            onPress={() => void ask()}
            loading={busy}
          />
        )
      }
    >
      <Text variant="h1">{t("rotation.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("rotation.body")}
      </Text>
      {busy && items ? (
        <>
          <Text variant="display" align="center">
            {`${Math.round((done / Math.max(1, total)) * 100)}%`}
          </Text>
          <ProgressBar value={done / Math.max(1, total)} />
          <Text variant="body-sm" color="text.muted" align="center">
            {t("rotation.progress", { done, total })}
          </Text>
          <Callout
            tone="warning"
            icon="alert-triangle"
            text={t("rotation.note")}
          />
        </>
      ) : (
        <>
          <BulletCard
            icon="info"
            title={t("rotation.whenTitle")}
            items={[
              t("rotation.when1"),
              t("rotation.when2"),
              t("rotation.when3"),
            ]}
          />
          <BulletCard
            icon="sync"
            title={t("rotation.whatTitle")}
            items={[
              t("rotation.what1"),
              t("rotation.what2"),
              t("rotation.what3"),
              t("rotation.what4"),
            ]}
          />
        </>
      )}
      <StateSheet
        visible={confirming}
        onDismiss={() => setConfirming(false)}
        icon="sync"
        tone="info"
        title={t("rotation.confirmTitle")}
        body={
          shared > 0
            ? t("rotation.confirmBodyShared", {
                items: total,
                contacts: shared,
              })
            : t("rotation.confirmBody", { items: total })
        }
        primary={{
          label: t("rotation.confirm"),
          onPress: () => items && void run(items),
        }}
        secondary={{
          label: t("common.cancel"),
          onPress: () => setConfirming(false),
        }}
      >
        <Callout
          tone="warning"
          icon="alert-triangle"
          text={t("rotation.note")}
        />
      </StateSheet>
    </Screen>
  );
}
