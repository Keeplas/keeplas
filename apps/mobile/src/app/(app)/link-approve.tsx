import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { Callout, Card, IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { BiometricRing } from "@/features/biometric-ring";
import { usePairingLabels } from "@/features/link/use-pairing-labels";
import {
  PairingKeyMismatch,
  useApprovePairing,
} from "@/features/link/use-approve-pairing";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** M03-5 Link this browser? Approve needs Face ID; Cancel declines. */
export default function LinkApprove() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    s = "",
    h = "",
    o = "",
  } = useLocalSearchParams<{ s: string; h: string; o: string }>();
  const sessionId = s as Id<"pairing_sessions">;
  const session = useQuery(api.pairing.get, { sessionId });
  const reject = useAuditedMutation(api.pairing.reject);
  const approvePairing = useApprovePairing();
  const [seenAt] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const labels = usePairingLabels(
    session?.userAgent ?? "",
    session?.approxLocation ?? "",
    seenAt,
  );
  const header = <AppHeader onBack={router.back} />;

  if (session === null) {
    return (
      <Screen header={header}>
        <StateMessage
          icon="clock"
          tone="warning"
          title={t("scan.expiredTitle")}
          body={t("scan.expiredBody")}
          primary={{
            label: t("scan.scanAgain"),
            onPress: () => router.replace("/scan"),
          }}
        />
      </Screen>
    );
  }

  async function approve() {
    if (!session) return;
    setBusy(true);
    try {
      await approvePairing(
        { sessionId: s, keyHash: h, origin: o },
        session.browserPublicKey,
      );
      router.replace({
        pathname: "/link-connected",
        params: {
          device: labels.device,
          location: labels.location,
          time: labels.time,
        },
      });
    } catch (error) {
      if (error instanceof PairingKeyMismatch) {
        await reject({ sessionId, reason: "key_mismatch" }).catch(
          () => undefined,
        );
        router.replace({
          pathname: "/link-blocked",
          params: { expected: h, received: error.receivedHash },
        });
      } else {
        Alert.alert(t("common.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await reject({ sessionId, reason: "declined" }).catch(() => undefined);
    router.back();
  }

  return (
    <Screen header={header}>
      <Text variant="h1">{t("linkBrowser.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("linkBrowser.body")}
      </Text>
      <Card style={styles.device} gap={8}>
        <IconTile icon="globe" size={48} />
        <Text variant="h3" align="center">
          {labels.device}
        </Text>
        <View style={styles.inline}>
          <Icon name="map-pin" size={16} color="text.muted" />
          <Text variant="body-sm" color="text.muted">
            {labels.location}
          </Text>
        </View>
        <Text variant="body-sm" color="text.subtle">
          {labels.time}
        </Text>
      </Card>
      <View style={styles.face}>
        <BiometricRing kind="fingerprint" size={104} />
        <Text variant="h3" align="center">
          {t("linkBrowser.confirmTitle")}
        </Text>
        <Text variant="body-sm" color="text.muted" align="center">
          {t("linkBrowser.confirmBody")}
        </Text>
      </View>
      <Callout
        tone="warning"
        icon="alert-circle"
        text={t("linkBrowser.warning")}
      />
      <Button
        label={t("linkBrowser.approve")}
        loading={busy || session === undefined}
        onPress={approve}
      />
      <Button
        variant="secondary"
        label={t("linkBrowser.cancel")}
        onPress={cancel}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  device: { alignItems: "center", paddingVertical: 18 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  face: { alignItems: "center", gap: 8 },
});
