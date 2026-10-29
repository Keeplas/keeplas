import { useState } from "react";
import { useRouter } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { serializeSecretKey, wrapDek } from "@keeplas/crypto/kem";
import {
  contactKeyMaterial,
  deriveContactTrust,
  type ContactKeyMaterial,
} from "@keeplas/crypto/sig";

import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateSheet } from "@/components/state-message";
import { BulletCard, Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { requireCarriedOverKey } from "@/crypto/contact-keys";
import { readDeviceRootKey, saveDeviceVault } from "@/crypto/device-vault";
import { encryptText, exportRawKey } from "@/crypto/envelope";
import { buildKeyBundle, createPublicKeyMaterial } from "@/crypto/vault-keys";
import { useContactTrust } from "@/features/vault/use-contact-trust";
import { useVaultData } from "@/features/vault/vault-data";
import { serverMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";

type Items = FunctionReturnType<typeof api.rotation.getRotatableItems>;

/** On-phone key rotation. Existing item DEKs stay stable; every wrap changes. */
export default function RotateKeys() {
  const withPin = useWithPin();
  const router = useRouter();
  const convex = useConvex();
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { ownerKeys, itemKey } = useVaultData();
  const rotate = useAuditedMutation(api.rotation.rotateKeyMaterial);
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const finalize = useAuditedMutation(api.rotation.finalizeRotation);
  const { trust, pin: persistPin } = useContactTrust();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Items | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(0);

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
    if (!viewer.phraseSalt) return;
    setBusy(true);
    setDone(0);
    let rawNew: Uint8Array | null = null;
    let rootKey: Uint8Array | null = null;
    let devicePin: string | undefined;
    try {
      if (items.some((item) => !item.ownerWrappedDek))
        throw new Error(t("rotation.legacy"));
      const pinned = await withPin(async (code) => ({
        pin: code,
        rootKey: await readDeviceRootKey(viewer._id, t("rotation.auth"), code),
      }));
      rootKey = pinned.rootKey;
      devicePin = pinned.pin;
      if (!rootKey) throw new Error(t("rotation.noRoot"));
      if (!trust) throw new Error("Vault is locked");
      const oldKeys = await ownerKeys();
      const newMaster = await generateMasterKey();
      rawNew = await exportRawKey(newMaster);
      const next = await createPublicKeyMaterial(newMaster, viewer._id);
      // Contact pins are MACed under the MasterKey: each is verified under the
      // current one and re-MACed under the new one, once per contact.
      const from = await trust;
      const to = await deriveContactTrust(viewer._id, newMaster);
      const carried = new Map<string, Promise<string>>();
      const carry = (contact: ContactKeyMaterial) => {
        let key = carried.get(contact.contactId);
        if (!key) {
          key = requireCarriedOverKey(contact, from, to, persistPin);
          carried.set(contact.contactId, key);
        }
        return key;
      };
      await rotate({
        encryptedKeyBundle: await buildKeyBundle(
          rawNew,
          rootKey,
          viewer.phraseSalt,
        ),
        publicKey: next.publicKeys.publicKey,
        publicKeySignature: next.publicKeys.publicKeySignature,
        identityPublicKey: next.publicKeys.identityPublicKey,
        encryptedIdentitySecretKey: next.publicKeys.encryptedIdentitySecretKey,
        encryptedAsymmetricSecretKey:
          next.publicKeys.encryptedAsymmetricSecretKey,
        encryptedAsymmetricSecretKeyPrev: await encryptText(
          serializeSecretKey(oldKeys.secretKey),
          newMaster,
        ),
      });
      // Every pinned contact, not only item recipients (e.g. trust contacts
      // holding recovery shares). One that fails keeps its pin; if it is a
      // recipient, its wrap below throws as before.
      for (const contact of await convex.query(
        api.trusted_contacts.getContacts,
      )) {
        if (!contact.pinnedIdentityFingerprint) continue;
        await carry(contactKeyMaterial(contact)).catch(() => undefined);
      }
      for (const [index, item] of items.entries()) {
        const dek = await itemKey(item);
        const recipients = await convex.query(api.rotation.getItemRecipients, {
          itemId: item._id,
        });
        const recipientKeys = await Promise.all(
          recipients.map(async (recipient) => ({
            contactId: recipient.contactId,
            wrappedDek: await wrapDek(
              dek,
              await carry(
                contactKeyMaterial({ _id: recipient.contactId, ...recipient }),
              ),
            ),
          })),
        );
        await updateItem({
          itemId: item._id,
          ownerWrappedDek: await wrapDek(dek, next.publicKeys.publicKey),
          recipientKeys,
        });
        setDone(index + 1);
      }
      await finalize({});
      await saveDeviceVault(
        viewer._id,
        { masterKey: rawNew, rootKey },
        t("unlock.title"),
        devicePin,
      );
      await adopt(rawNew.slice());
      router.back();
    } catch (error) {
      if (isPinAbort(error)) return;
      toast({
        variant: "error",
        title: t("rotation.failed"),
        description: serverMessage(error),
      });
    } finally {
      rawNew?.fill(0);
      rootKey?.fill(0);
      setBusy(false);
    }
  }

  const total = items?.length ?? 0;
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
