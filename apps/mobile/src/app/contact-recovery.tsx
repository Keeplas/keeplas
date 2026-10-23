import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
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
import { ProgressBar } from "@/components/controls";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { saveDeviceVault } from "@/crypto/device-vault";
import { createKitMaterial } from "@/crypto/vault-keys";
import { useEnsurePhoneProof } from "@/features/phone-proof";
import { formatDate, formatTime } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { colors as palette, radius } from "@/theme";

const secretKey = (userId: string) => `keeplas.recovery-device.${userId}`;

/** M02-1 / M02-2 / M02-4: start, monitor and finish 2-of-3 recovery. */
export default function ContactRecovery() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { colors } = useTheme();
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
  const ensurePhoneProof = useEnsurePhoneProof();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (request)
      void recoveryCode(request.requestId, request.newDevicePublicKey).then(
        setCode,
      );
  }, [request]);

  async function begin() {
    if (!ensurePhoneProof()) return;
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
      router.replace({ pathname: "/(setup)/kit", params: { restored: "1" } });
    } catch {
      Alert.alert(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const closed =
    !request ||
    ["cancelled", "expired", "rejected", "rotated"].includes(request.status);
  const approvals =
    request?.contacts.filter((contact) => contact.decision === "approve")
      .length ?? 0;
  const rejected = request?.contacts.find(
    (contact) => contact.decision === "reject",
  );
  const windowLeft = request ? Math.max(0, request.windowEndsAt - now) : 0;
  const windowTotal = request ? request.windowEndsAt - request.createdAt : 1;

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={14}
      footer={
        closed ? (
          <Button
            label={t("socialRecovery.start")}
            onPress={() => void begin()}
            loading={busy}
          />
        ) : request.status === "released" ? (
          <Button
            label={t("socialRecovery.restore")}
            onPress={() => void finish()}
            loading={busy}
          />
        ) : (
          <Button
            variant="danger"
            label={t("socialRecovery.cancel")}
            onPress={() =>
              cancel({}).catch(() => Alert.alert(t("common.genericError")))
            }
          />
        )
      }
    >
      {closed ? (
        <>
          <Text variant="h1">{t("socialRecovery.title")}</Text>
          <Text variant="body-lg" color="text.muted">
            {t("socialRecovery.body")}
          </Text>
          {request?.status === "expired" ? (
            <Callout
              tone="warning"
              icon="clock"
              text={t("socialRecovery.expired")}
            />
          ) : request?.status === "rejected" ? (
            <Callout
              tone="danger"
              icon="alert-triangle"
              text={t("socialRecovery.rejected", {
                name: rejected?.name || t("recoveryCenter.owner"),
              })}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text variant="h1">{t("socialRecovery.requestTitle")}</Text>
          <Text variant="body-lg" color="text.muted">
            {t("socialRecovery.requestBody")}
          </Text>
          <Card>
            <Text variant="label">
              {t("socialRecovery.approvals", { n: Math.min(approvals, 2) })}
            </Text>
            <ProgressBar value={Math.min(approvals, 2) / 2} />
            <Text variant="body-sm" color="text.muted">
              {approvals >= 2
                ? t("socialRecovery.approvalsDone")
                : t("socialRecovery.approvalsLeft", { n: 2 - approvals })}
            </Text>
          </Card>
          <Card>
            {request.contacts.map((contact, index) => (
              <View key={contact.contactId} style={styles.contact}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        AVATAR_COLORS[index % AVATAR_COLORS.length],
                    },
                  ]}
                >
                  <Text variant="label" color="text.inverse">
                    {(contact.name || "?").trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="label">{contact.name}</Text>
                  {contact.decidedAt ? (
                    <Text variant="body-sm" color="text.muted">
                      {`${formatDate(contact.decidedAt, language)} · ${formatTime(contact.decidedAt, language)}`}
                    </Text>
                  ) : null}
                </View>
                <StatusChip
                  label={
                    contact.decision === "approve"
                      ? t("socialRecovery.approved")
                      : contact.decision === "reject"
                        ? t("socialRecovery.declined")
                        : t("socialRecovery.waiting")
                  }
                  tone={
                    contact.decision === "approve"
                      ? "success"
                      : contact.decision === "reject"
                        ? "danger"
                        : "warning"
                  }
                />
              </View>
            ))}
          </Card>
          <View style={[styles.window, { backgroundColor: colors["bg.info"] }]}>
            <View style={styles.contact}>
              <Icon name="clock" size={22} color="text.primary" />
              <View style={styles.flex}>
                <Text variant="label">{t("socialRecovery.windowTitle")}</Text>
                <Text variant="body-sm" color="text.muted">
                  {t("socialRecovery.windowStarted")}
                </Text>
              </View>
            </View>
            <Text variant="h2">
              {windowLeft > 0
                ? t("socialRecovery.hoursLeft", {
                    n: Math.ceil(windowLeft / 3_600_000),
                  })
                : t("socialRecovery.windowOver")}
            </Text>
            <ProgressBar value={1 - windowLeft / windowTotal} />
            <Text variant="body-sm" color="text.muted">
              {t("socialRecovery.windowBody")}
            </Text>
          </View>
          <View style={styles.codeRow}>
            <View
              style={[
                styles.codeBox,
                {
                  backgroundColor: colors["bg.info"],
                  borderColor: colors["border.strong"],
                },
              ]}
            >
              <Text variant="code">{code}</Text>
            </View>
            <Text variant="body-sm" color="text.muted" style={styles.flex}>
              {t("socialRecovery.codeBody")}
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const AVATAR_COLORS = Object.values(palette.category);

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  contact: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  window: { gap: 10, padding: 16, borderRadius: radius.md },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  codeBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
