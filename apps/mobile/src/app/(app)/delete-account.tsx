import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { unlockDeviceVault } from "@/crypto/device-vault";
import { formatDate } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

const LOSSES = ["items", "shares", "succession", "plan"] as const;

export default function DeleteAccount() {
  const router = useRouter();
  const { t, language } = useI18n();
  const viewer = useViewer();
  const status = useQuery(api.account_deletion.getStatus);
  const requestDeletion = useAuditedMutation(api.account_deletion.request);
  const cancelDeletion = useAuditedMutation(api.account_deletion.cancel);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = t("deleteAccount.confirmWord");
  const confirmed = typed.trim().toUpperCase() === word;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setTyped("");
    } catch {
      setError(t("deleteAccount.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletion() {
    try {
      const key = await unlockDeviceVault(
        viewer._id,
        t("deleteAccount.verify"),
      );
      key.fill(0);
    } catch {
      return;
    }
    await run(() => requestDeletion({ confirmation: "DELETE" }));
  }

  if (status) {
    return (
      <Screen
        header={<AppHeader onBack={router.back} />}
        gap={14}
        footer={
          <Button
            label={t("deleteAccount.cancel")}
            loading={busy}
            onPress={() => void run(() => cancelDeletion({}))}
          />
        }
      >
        <Text variant="h1">{t("deleteAccount.scheduledTitle")}</Text>
        <Text variant="body-lg" color="text.muted">
          {t("deleteAccount.scheduledBody", {
            date: formatDate(status.scheduledAt, language),
          })}
        </Text>
        <ListRow
          icon="download"
          title={t("deleteAccount.exportFirst")}
          description={t("deleteAccount.exportHint")}
          onPress={() => router.push("/export")}
        />
        {error ? (
          <Callout tone="danger" icon="alert-triangle" text={error} />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      header={<AppHeader onBack={router.back} />}
      gap={14}
      footer={
        <View style={styles.footer}>
          <Button
            variant="danger"
            label={t("deleteAccount.submit")}
            loading={busy}
            disabled={!confirmed || status === undefined}
            onPress={() => void confirmDeletion()}
          />
          <Button
            variant="secondary"
            label={t("deleteAccount.keep")}
            onPress={router.back}
          />
        </View>
      }
    >
      <Text variant="h1">{t("deleteAccount.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("deleteAccount.body")}
      </Text>
      <Card gap={12}>
        <Text variant="label">{t("deleteAccount.losesTitle")}</Text>
        {LOSSES.map((key) => (
          <View key={key} style={styles.loss}>
            <Icon name="alert-circle" size={18} color="status.revoked" />
            <Text variant="body" style={styles.flex}>
              {t(`deleteAccount.loses.${key}`)}
            </Text>
          </View>
        ))}
      </Card>
      <ListRow
        icon="download"
        title={t("deleteAccount.exportFirst")}
        description={t("deleteAccount.exportHint")}
        onPress={() => router.push("/export")}
      />
      <Callout
        tone="warning"
        icon="alert-triangle"
        text={t("deleteAccount.graceNote")}
      />
      <TextField
        label={t("deleteAccount.typeLabel", { word })}
        value={typed}
        onChangeText={setTyped}
        placeholder={word}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {error ? (
        <Callout tone="danger" icon="alert-triangle" text={error} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  loss: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
