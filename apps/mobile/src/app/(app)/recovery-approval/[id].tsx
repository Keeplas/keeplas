import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { approveRecovery, recoveryCode } from "@keeplas/crypto/social";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useVaultData } from "@/features/vault/vault-data";

/** M02-3 / M09-5: phone-call code comparison then signed share approval. */
export default function RecoveryApproval() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const requests = useQuery(api.recovery.getRequestsForMe);
  const request = requests?.find((candidate) => candidate.requestId === id);
  const { ownerKeys } = useVaultData();
  const approve = useAuditedMutation(api.recovery.approve);
  const reject = useAuditedMutation(api.recovery.reject);

  async function accept() {
    if (!request) return;
    try {
      const keys = await ownerKeys();
      if (!keys.identitySecretKey) throw new Error("Identity key unavailable");
      const sealed = await approveRecovery({
        wrappedShare: request.wrappedShare,
        ownerUserId: request.ownerUserId,
        contactId: request.contactId,
        generation: request.generation,
        requestId: request.requestId,
        devicePublicKey: request.newDevicePublicKey,
        contactSecretKey: keys.secretKey,
        contactIdentitySecretKey: keys.identitySecretKey,
      });
      await approve({ requestId: request.requestId, ...sealed });
      router.back();
    } catch (error) {
      Alert.alert(
        t("common.genericError"),
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  return (
    <Screen
      header={<NavBar title={t("approval.title")} onBack={router.back} />}
    >
      <Text variant="h1">{t("approval.title")}</Text>
      <Text color="text.muted">
        {t("approval.body", { name: request?.ownerName ?? "" })}
      </Text>
      <Button
        label={t("approval.showCode")}
        onPress={() =>
          request &&
          void recoveryCode(request.requestId, request.newDevicePublicKey).then(
            (code) => Alert.alert(t("approval.code"), code),
          )
        }
        disabled={!request}
      />
      <Callout tone="warning" icon="phone" text={t("approval.call")} />
      <Button
        label={t("approval.matches")}
        onPress={() => void accept()}
        disabled={!request}
      />
      <Button
        variant="danger"
        label={t("approval.mismatch")}
        onPress={() =>
          request &&
          void reject({
            requestId: request.requestId as Id<"recovery_requests">,
            reason: "code_mismatch",
          }).then(() => router.back())
        }
        disabled={!request}
      />
    </Screen>
  );
}
