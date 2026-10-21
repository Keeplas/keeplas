import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { serializeSecretKey, wrapDek } from "@keeplas/crypto/kem";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { readDeviceRootKey, saveDeviceVault } from "@/crypto/device-vault";
import { encryptText, exportRawKey } from "@/crypto/envelope";
import { buildKeyBundle, createPublicKeyMaterial } from "@/crypto/vault-keys";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";
import { isPinAbort, useWithPin } from "@/features/pin/use-pin-gate";

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
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function run() {
    if (!viewer.phraseSalt) return;
    setBusy(true);
    let rawNew: Uint8Array | null = null;
    let rootKey: Uint8Array | null = null;
    let devicePin: string | undefined;
    try {
      const items = await convex.query(api.rotation.getRotatableItems);
      if (items.some((item) => !item.ownerWrappedDek))
        throw new Error(t("rotation.legacy"));
      const pinned = await withPin(async (code) => ({
        pin: code,
        rootKey: await readDeviceRootKey(viewer._id, t("rotation.auth"), code),
      }));
      rootKey = pinned.rootKey;
      devicePin = pinned.pin;
      if (!rootKey) throw new Error(t("rotation.noRoot"));
      const oldKeys = await ownerKeys();
      const newMaster = await generateMasterKey();
      rawNew = await exportRawKey(newMaster);
      const next = await createPublicKeyMaterial(newMaster);
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
      // A contact's key only needs one ML-DSA verification per rotation, not
      // one per item it is shared with.
      const verifiedKeys = new Map<string, Promise<string>>();
      for (const [index, item] of items.entries()) {
        const dek = await itemKey(item);
        const recipients = await convex.query(api.rotation.getItemRecipients, {
          itemId: item._id,
        });
        const recipientKeys = await Promise.all(
          recipients.map(async (recipient) => {
            let verified = verifiedKeys.get(recipient.contactId);
            if (!verified) {
              verified = requireVerifiedKey(
                contactKeyMaterial({ _id: recipient.contactId, ...recipient }),
                (contactId, fingerprint) =>
                  pin({
                    contactId: contactId as typeof recipient.contactId,
                    fingerprint,
                  }),
              );
              verifiedKeys.set(recipient.contactId, verified);
            }
            return {
              contactId: recipient.contactId,
              wrappedDek: await wrapDek(dek, await verified),
            };
          }),
        );
        await updateItem({
          itemId: item._id,
          ownerWrappedDek: await wrapDek(dek, next.publicKeys.publicKey),
          recipientKeys,
        });
        setProgress(
          Math.round(((index + 1) / Math.max(1, items.length)) * 100),
        );
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
      Alert.alert(
        t("rotation.failed"),
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      rawNew?.fill(0);
      rootKey?.fill(0);
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<NavBar title={t("rotation.title")} onBack={router.back} />}
      footer={
        <Button
          label={t("rotation.start")}
          onPress={() => void run()}
          loading={busy}
        />
      }
    >
      <Text variant="h1">{t("rotation.title")}</Text>
      <Text color="text.muted">{t("rotation.body")}</Text>
      {busy ? (
        <Text variant="display" align="center">
          {progress}%
        </Text>
      ) : null}
      <Callout tone="warning" icon="alert-triangle" text={t("rotation.note")} />
    </Screen>
  );
}
