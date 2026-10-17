import { useEffect, useState } from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import {
  generateRecipientKeyPair,
  parseSecretKey,
  serializePublicKey,
  serializeSecretKey,
} from "@keeplas/crypto/kem";
import { openSocialRecovery, recoveryCode } from "@keeplas/crypto/social";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { saveDeviceVault } from "@/crypto/device-vault";
import { createKitMaterial } from "@/crypto/vault-keys";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

const secretKey = (userId: string) => `keeplas.recovery-device.${userId}`;

/** M02-1 / M02-2 / M02-4: start, monitor and finish 2-of-3 recovery. */
export default function ContactRecovery() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const request = useQuery(api.recovery.getMyRequest);
  const start = useAuditedMutation(api.recovery.start);
  const cancel = useAuditedMutation(api.recovery.cancel);
  const releasePackage = useQuery(
    api.recovery.getReleasePackage,
    request?.status === "released" ? { requestId: request.requestId } : "skip",
  );
  const { adopt, setSetupPhrase } = useVault();
  const { refreshDeviceVault } = useSession();
  const storePhraseHash = useMutation(api.onboarding.storeRecoveryPhraseHash);
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request)
      void recoveryCode(request.requestId, request.newDevicePublicKey).then(
        setCode,
      );
  }, [request]);

  async function begin() {
    setBusy(true);
    try {
      const pair = generateRecipientKeyPair();
      const publicKey = serializePublicKey(pair.publicKey);
      await SecureStore.setItemAsync(
        secretKey(viewer._id),
        serializeSecretKey(pair.secretKey),
      );
      await start({ newDevicePublicKey: publicKey });
    } catch {
      Alert.alert(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!request || !releasePackage) return;
    setBusy(true);
    try {
      const stored = await SecureStore.getItemAsync(secretKey(viewer._id));
      if (!stored) throw new Error("Missing recovery key");
      const masterKey = await openSocialRecovery({
        ownerUserId: viewer._id,
        generation: releasePackage.generation,
        requestId: request.requestId,
        devicePublicKey: releasePackage.newDevicePublicKey,
        deviceSecretKey: parseSecretKey(stored),
        wrappedGateKey: releasePackage.wrappedGateKey,
        socialEnvelope: releasePackage.socialEnvelope,
        approvals: releasePackage.approvals,
      });
      const kit = await createKitMaterial(masterKey);
      await Promise.all([
        storePhraseHash({
          recoveryPhraseHash: kit.recoveryPhraseHash,
          phraseSalt: kit.phraseSalt,
        }),
        storeKeyBundle({
          encryptedKeyBundle: kit.encryptedKeyBundle,
          phraseSalt: kit.phraseSalt,
        }),
      ]);
      await saveDeviceVault(
        viewer._id,
        { masterKey, rootKey: kit.rawRootKey },
        t("unlock.title"),
      );
      kit.rawRootKey.fill(0);
      await adopt(masterKey.slice());
      setSetupPhrase(kit.phrase);
      masterKey.fill(0);
      await SecureStore.deleteItemAsync(secretKey(viewer._id));
      refreshDeviceVault();
      router.replace("/(setup)/kit");
    } catch {
      Alert.alert(t("common.genericError"));
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
      <Text variant="h1">{t("socialRecovery.title")}</Text>
      <Text color="text.muted">{t("socialRecovery.body")}</Text>
      {!request ||
      ["cancelled", "expired", "rejected", "rotated"].includes(
        request.status,
      ) ? (
        <Button
          label={t("socialRecovery.start")}
          onPress={() => void begin()}
          loading={busy}
        />
      ) : (
        <>
          <StatusChip
            label={request.status}
            tone={request.status === "released" ? "success" : "warning"}
          />
          <Text variant="display" align="center">
            {code}
          </Text>
          <Callout icon="phone" text={t("socialRecovery.codeBody")} />
          {request.contacts.map((contact) => (
            <Text key={contact.contactId}>
              {contact.name}: {contact.decision ?? t("socialRecovery.waiting")}
            </Text>
          ))}
          {request.status === "released" ? (
            <Button
              label={t("socialRecovery.restore")}
              onPress={() => void finish()}
              loading={busy}
            />
          ) : null}
          <Button
            variant="text"
            label={t("common.cancel")}
            onPress={() =>
              cancel({}).catch(() => Alert.alert(t("common.genericError")))
            }
          />
        </>
      )}
    </Screen>
  );
}
