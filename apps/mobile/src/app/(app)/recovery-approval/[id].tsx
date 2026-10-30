import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { approveRecovery, recoveryCode } from "@keeplas/crypto/social";

import VerificationCall from "../../../../assets/illustrations/verification-call.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { Icon, type IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { Callout, Card, IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

const spaced = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

/** M02-3 Contact recovery approval, with the M09-5 "codes don't match" step. */
export default function RecoveryApproval() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const requests = useQuery(api.recovery.getRequestsForMe);
  const request = requests?.find((candidate) => candidate.requestId === id);
  const { ownerKeys } = useVaultData();
  const approve = useAuditedMutation(api.recovery.approve);
  const reject = useAuditedMutation(api.recovery.reject);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  // Answered: the request leaves getRequestsForMe while the screen closes.
  const [answered, setAnswered] = useState(false);
  const name = request?.ownerName || t("recoveryCenter.owner");

  useEffect(() => {
    if (request)
      void recoveryCode(request.requestId, request.newDevicePublicKey).then(
        setCode,
      );
  }, [request]);

  async function accept() {
    if (!request) return;
    setBusy(true);
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
      setAnswered(true);
      router.back();
    } catch {
      toast({
        variant: "error",
        title: t("approval.failedTitle"),
        description: t("approval.failedBody"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!request) return;
    setBusy(true);
    try {
      await reject({
        requestId: request.requestId as Id<"recovery_requests">,
        reason: "code_mismatch",
      });
      setAnswered(true);
      router.back();
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <AppHeader onBack={mismatch ? () => setMismatch(false) : router.back} />
  );

  if (requests === undefined || answered) {
    return (
      <Screen header={header} center>
        <ActivityIndicator color={colors["text.muted"]} />
      </Screen>
    );
  }
  if (!request) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="info"
          tone="info"
          title={t("approval.goneTitle")}
          body={t("approval.goneBody")}
          primary={{ label: t("common.back"), onPress: router.back }}
        />
      </Screen>
    );
  }

  if (mismatch) {
    const steps: { icon: IconName; title: string; body: string }[] = [
      {
        icon: "close",
        title: t("approval.dontApprove"),
        body: t("approval.dontApproveBody"),
      },
      {
        icon: "phone",
        title: t("approval.callBack", { name }),
        body: t("approval.callBackBody"),
      },
      {
        icon: "check",
        title: t("approval.stillDifferent"),
        body: t("approval.stillDifferentBody", { name }),
      },
    ];
    return (
      <Screen
        header={header}
        gap={14}
        footer={
          <View style={styles.footer}>
            <Button
              variant="danger"
              label={t("approval.decline")}
              loading={busy}
              onPress={() => void decline()}
            />
            <Button
              variant="secondary"
              label={t("approval.compareAgain")}
              onPress={() => setMismatch(false)}
            />
          </View>
        }
      >
        <IconTile
          icon="alert-triangle"
          size={56}
          background={colors["status.pending.bg"]}
          color="status.pending"
        />
        <Text variant="h1">{t("approval.mismatchTitle")}</Text>
        <Text variant="body" color="text.muted">
          {t("approval.mismatchBody", { name })}
        </Text>
        <View
          style={[
            styles.codeCard,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.strong"],
            },
          ]}
        >
          <Text variant="caption" color="text.muted">
            {t("approval.codeOnScreen")}
          </Text>
          <Text variant="code">{spaced(code)}</Text>
        </View>
        <Card gap={14}>
          <Text variant="caption" color="text.muted">
            {t("approval.doThis")}
          </Text>
          {steps.map((step) => (
            <View key={step.title} style={styles.step}>
              <Icon
                name={step.icon}
                size={20}
                color={
                  step.icon === "close" ? "status.revoked" : "text.primary"
                }
              />
              <View style={styles.flex}>
                <Text variant="label">{step.title}</Text>
                <Text variant="body-sm" color="text.muted">
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      gap={14}
      footer={
        <View style={styles.footer}>
          <Checkbox
            checked={verified}
            onChange={setVerified}
            label={t("approval.verified", { name, code: spaced(code) })}
          />
          <Button
            label={t("approval.approve")}
            loading={busy}
            disabled={!request || !verified}
            onPress={() => void accept()}
          />
          <Button
            variant="danger"
            label={t("approval.reject")}
            disabled={!request || busy}
            onPress={() => setMismatch(true)}
          />
          <Callout icon="info" text={t("approval.cannotRead", { name })} />
        </View>
      }
    >
      <Text variant="h1" align="center">
        {t("approval.title", { name })}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("approval.body", { name })}
      </Text>
      <View
        style={[
          styles.codeCard,
          styles.center,
          {
            backgroundColor: colors["bg.info"],
            borderColor: colors["bg.info"],
          },
        ]}
      >
        <Text variant="body-sm" color="text.muted">
          {t("approval.code")}
        </Text>
        <Text variant="code">{spaced(code)}</Text>
      </View>
      <View style={styles.center}>
        <VerificationCall width={320} height={220} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12 },
  flex: { flex: 1, gap: 2 },
  center: { alignSelf: "center", alignItems: "center" },
  codeCard: {
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  step: { flexDirection: "row", gap: 12 },
});
