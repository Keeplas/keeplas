import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "convex/react";
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
import { vaultOpenErrorKey } from "@/features/kit-open";
import { useEnsurePhoneProof } from "@/features/phone-proof";
import { useScreenLock } from "@/features/screen-lock";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useReplaceKit } from "@/lib/use-replace-kit";
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
  const health = useQuery(api.recovery.getHealth);
  const start = useAuditedMutation(api.recovery.start);
  const cancel = useAuditedMutation(api.recovery.cancel);
  const releasePackage = useQuery(
    api.recovery.getReleasePackage,
    request?.status === "released" ? { requestId: request.requestId } : "skip",
  );
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();
  const replaceKit = useReplaceKit();
  const screenLock = useScreenLock();
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
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!request || !releasePackage || !screenLock.ensure()) return;
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
      // The old words may be what was lost: new ones (never shown) give
      // this phone a RootKey, so the cloud backup is sealed again.
      await replaceKit(viewer._id, masterKey);
      await adopt(masterKey.slice());
      masterKey.fill(0);
      await SecureStore.deleteItemAsync(secretKey(viewer._id));
      refreshDeviceVault();
      router.replace("/vault-restored");
    } catch (error) {
      toast({ variant: "error", title: t(vaultOpenErrorKey(error)) });
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    Alert.alert(
      t("socialRecovery.cancelTitle"),
      t("socialRecovery.cancelBody"),
      [
        { text: t("socialRecovery.keep"), style: "cancel" },
        {
          text: t("socialRecovery.cancel"),
          style: "destructive",
          onPress: () =>
            cancel({}).catch(() =>
              toast({ variant: "error", title: t("common.genericError") }),
            ),
        },
      ],
    );
  }

  const closed =
    !request ||
    ["cancelled", "expired", "rejected", "rotated"].includes(request.status);
  const notReady = closed && health?.trustContacts.configured === false;
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
        notReady ? (
          <Button
            label={t("socialRecovery.useKit")}
            onPress={() => router.replace("/recovery-kit")}
          />
        ) : closed ? (
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
            onPress={confirmCancel}
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
          {notReady ? (
            <Callout
              tone="warning"
              icon="people"
              text={t("socialRecovery.notReady")}
            />
          ) : request?.status === "expired" ? (
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
              {t("socialRecovery.approvals", {
                count: Math.min(approvals, 2),
              })}
            </Text>
            <ProgressBar value={Math.min(approvals, 2) / 2} />
            <Text variant="body-sm" color="text.muted">
              {approvals >= 2
                ? t("socialRecovery.approvalsDone")
                : t("socialRecovery.approvalsLeft", { count: 2 - approvals })}
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
                    count: Math.ceil(windowLeft / 3_600_000),
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
      {screenLock.sheet}
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
