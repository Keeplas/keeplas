import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import QRCode from "react-native-qrcode-svg";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  buildPairingQr,
  generateBrowserPairingKeys,
  openPairingEnvelope,
  pairingKeyHash,
} from "@keeplas/crypto/pairing";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Callout, Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { saveDeviceVault } from "@/crypto/device-vault";
import { deviceLabel } from "@/lib/attestation";
import { env } from "@/lib/env";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { radius } from "@/theme";

type Phase =
  | { kind: "creating" }
  | { kind: "waiting"; sessionId: Id<"pairing_sessions">; qr: string }
  | { kind: "opening" }
  | { kind: "failed"; message: string };

export default function LinkFromDevice() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();
  const createSession = useAuditedMutation(api.pairing.create);
  const claimEnvelope = useAuditedMutation(api.pairing.claimEnvelope);
  const [phase, setPhase] = useState<Phase>({ kind: "creating" });
  const [attempt, setAttempt] = useState(0);
  const secrets = useRef<{ secretKey: Uint8Array; loginSecret: string } | null>(
    null,
  );
  const sessionId = phase.kind === "waiting" ? phase.sessionId : null;
  const status = useQuery(
    api.pairing.status,
    sessionId ? { sessionId } : "skip",
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const keys = await generateBrowserPairingKeys();
        secrets.current?.secretKey.fill(0);
        secrets.current = {
          secretKey: keys.secretKey,
          loginSecret: keys.loginSecret,
        };
        const created = await createSession({
          browserPublicKey: keys.publicKey,
          secretHash: keys.loginSecretHash,
          userAgent: deviceLabel(),
        });
        const qr = buildPairingQr({
          sessionId: created.sessionId,
          keyHash: await pairingKeyHash(keys.publicKey),
          origin: env.appUrl,
        });
        if (alive) {
          setPhase({ kind: "waiting", sessionId: created.sessionId, qr });
        }
      } catch {
        if (alive)
          setPhase({ kind: "failed", message: t("linkDevice.failed") });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, createSession, t]);

  useEffect(
    () => () => {
      secrets.current?.secretKey.fill(0);
      secrets.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!sessionId || status !== "approved" || !secrets.current) return;
    const current = secrets.current;
    secrets.current = null;
    void (async () => {
      try {
        if (!viewer.identityPublicKey) throw new Error("No identity key");
        const sealed = await claimEnvelope({
          sessionId,
          secret: current.loginSecret,
        });
        const masterKey = await openPairingEnvelope({
          ...sealed,
          secretKey: current.secretKey,
          sessionId,
          origin: env.appUrl,
          identityPublicKey: viewer.identityPublicKey,
          userId: viewer._id,
        });
        await saveDeviceVault(
          viewer._id,
          { masterKey: masterKey.slice(), rootKey: null },
          t("unlock.title"),
        );
        await adopt(masterKey);
        refreshDeviceVault();
      } catch {
        setPhase({ kind: "failed", message: t("linkDevice.failed") });
      } finally {
        current.secretKey.fill(0);
      }
    })();
  }, [status, sessionId, viewer, claimEnvelope, adopt, refreshDeviceVault, t]);

  const shown: Phase =
    phase.kind !== "waiting"
      ? phase
      : status === "expired" || status === "consumed"
        ? { kind: "failed", message: t("linkDevice.expired") }
        : status === "rejected"
          ? { kind: "failed", message: t("linkDevice.rejected") }
          : status === "approved"
            ? { kind: "opening" }
            : phase;

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={14}
      footer={
        shown.kind === "failed" ? (
          <Button
            label={t("linkDevice.retry")}
            onPress={() => {
              setPhase({ kind: "creating" });
              setAttempt((n) => n + 1);
            }}
          />
        ) : undefined
      }
    >
      <Text variant="h1">{t("linkDevice.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("linkDevice.body")}
      </Text>
      <Card gap={10}>
        {(["step1", "step2", "step3"] as const).map((step, index) => (
          <View key={step} style={styles.step}>
            <View
              style={[styles.number, { backgroundColor: colors["bg.info"] }]}
            >
              <Text variant="label">{index + 1}</Text>
            </View>
            <Text variant="body" style={styles.flex}>
              {t(`linkDevice.${step}`, { menu: t("devices.linkComputer") })}
            </Text>
          </View>
        ))}
      </Card>
      {shown.kind === "waiting" ? (
        <View
          style={[
            styles.qr,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.default"],
            },
          ]}
        >
          <QRCode value={shown.qr} size={220} />
          <Text variant="body-sm" color="text.muted" align="center">
            {t("linkDevice.expires")}
          </Text>
        </View>
      ) : null}
      {shown.kind === "creating" || shown.kind === "opening" ? (
        <Text variant="body" color="text.muted" align="center">
          {shown.kind === "creating"
            ? t("linkDevice.preparing")
            : t("linkDevice.opening")}
        </Text>
      ) : null}
      {shown.kind === "failed" ? (
        <Callout tone="warning" icon="alert-triangle" text={shown.message} />
      ) : null}
      <Callout icon="shield-check" text={t("linkDevice.note")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  qr: {
    alignSelf: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
