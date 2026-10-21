import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Callout, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { PasskeyButton } from "@/features/passkey-step";
import { formatDate } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

export default function Passkeys() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const passkeys = useQuery(api.webauthn.listMyCredentials);
  const remove = useAuditedMutation(api.webauthn.removeCredential);

  function confirmRemove(id: Id<"passkey_credentials">, name: string) {
    const last = passkeys?.length === 1;
    Alert.alert(
      t("passkeys.removeTitle", { name }),
      t(last ? "passkeys.removeLastBody" : "passkeys.removeBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("passkeys.remove"),
          style: "destructive",
          onPress: () =>
            void remove({ credentialId: id }).catch(() =>
              Alert.alert(t("passkeys.removeFailed")),
            ),
        },
      ],
    );
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("privacy.passkey")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("passkeys.subtitle")}
      </Text>
      {passkeys?.length === 0 ? (
        <Callout tone="warning" icon="alert-circle" text={t("passkeys.none")} />
      ) : null}
      {passkeys?.map((passkey) => (
        <ListRow
          key={passkey._id}
          icon="fingerprint"
          title={passkey.deviceName ?? t("privacy.passkey")}
          description={
            passkey.lastUsedAt
              ? t("passkeys.lastUsed", {
                  date: formatDate(passkey.lastUsedAt, language),
                })
              : t("passkeys.addedOn", {
                  date: formatDate(passkey.createdAt, language),
                })
          }
          trailing={
            passkey.backedUp ? (
              <StatusChip tone="success" label={t("passkeys.synced")} />
            ) : undefined
          }
          onPress={() =>
            confirmRemove(
              passkey._id,
              passkey.deviceName ?? t("privacy.passkey"),
            )
          }
        />
      ))}
      <PasskeyButton
        userId={viewer._id}
        label={t("passkeys.add")}
        onDone={() => undefined}
      />
    </Screen>
  );
}
